import {

  useEffect,

  useState

} from 'react';

import {

  Alert,

  Badge,

  Button,

  Card,

  Col,

  Form,

  Modal,

  Row,

  Spinner,

  Table

} from 'react-bootstrap';

import {

  Link,

  useParams

} from 'react-router-dom';

import api, {

  fileUrl

} from '../api/client';

import {

  date,

  money

} from '../utils/format';

import PageHeader from '../components/PageHeader';

import StatusBadge from '../components/StatusBadge';

import POAdvanceSection from '../components/POAdvanceSection';

import { useAuth } from '../context/AuthContext';

/* =========================================================

   HELPERS

\\========================================================= */

function num(value) {

  const n =

    Number(value || 0);

  return Number.isFinite(n)

    ? n

    : 0;

}

function text(value) {

  return value || '—';

}



function userDisplay(value) {

  if (!value) return '—';

  if (typeof value === 'string') return 'User ID: ' + value;

  return value.name || value.email || '—';

}



function dateTime(value) {

  if (!value) return '—';

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return '—';

  return parsed.toLocaleString('en-IN', {

    day: '2-digit', month: 'short', year: 'numeric',

    hour: '2-digit', minute: '2-digit', hour12: true

  });

}



function poTypeLabel(value) {

  if (

    value ===

    'MATERIAL_AND_SERVICE'

  ) {

    return 'Material + Service';

  }

  if (

    value ===

    'MATERIAL'

  ) {

    return 'Material';

  }

  if (

    value ===

    'SERVICE'

  ) {

    return 'Service';

  }

  if (

    value ===

    'OTHER'

  ) {

    return 'Other';

  }

  return value || '—';

}

/* =========================================================

   APPROVAL HELPERS

\\========================================================= */

function effectiveApprovalStatus(document) {

  return (

    document?.approvalStatus ||

    'APPROVED'

  );

}

function POEditBadge({ po }) {

  const status =

    po?.editApprovalStatus ||

    'NONE';

  const revision =

    Number(

      po?.revisionNo ||

      0

    );

  if (

    status ===

    'PENDING'

  ) {

    return (

      <div className="d-flex flex-wrap gap-1">

        <Badge

          bg="warning"

          text="dark"

          className="fw-normal"

        >

          <i className="bi bi-clock-history me-1" />

          Edit Pending

        </Badge>

        {revision > 0 && (

          <Badge

            bg="light"

            text="dark"

            className="border fw-normal"

          >

            Current Rev {revision}

          </Badge>

        )}

      </div>

    );

  }

  if (

    status ===

    'REJECTED'

  ) {

    return (

      <div className="d-flex flex-wrap gap-1">

        <Badge

          bg="danger"

          className="fw-normal"

        >

          <i className="bi bi-x-circle me-1" />

          Edit Rejected

        </Badge>

        {revision > 0 && (

          <Badge

            bg="light"

            text="dark"

            className="border fw-normal"

          >

            Current Rev {revision}

          </Badge>

        )}

      </div>

    );

  }

  if (

    po?.isEdited ||

    revision > 0 ||

    status ===

      'APPROVED'

  ) {

    return (

      <Badge

        bg="info"

        text="dark"

        className="fw-normal"

      >

        <i className="bi bi-pencil-square me-1" />

        Edited • Rev {revision}

      </Badge>

    );

  }

  return (

    <Badge

      bg="light"

      text="dark"

      className="border fw-normal"

    >

      Original • Rev 0

    </Badge>

  );

}

function ApprovalBadge({

  status

}) {

  const value =

    status ||

    'APPROVED';

  if (

    value ===

    'PENDING'

  ) {

    return (

      <Badge

        bg="warning"

        text="dark"

        className="fw-normal"

      >

        Pending Approval

      </Badge>

    );

  }

  if (

    value ===

    'REJECTED'

  ) {

    return (

      <Badge

        bg="danger"

        className="fw-normal"

      >

        Rejected

      </Badge>

    );

  }

  return (

    <Badge

      bg="success"

      className="fw-normal"

    >

      Approved

    </Badge>

  );

}

function EditRevisionBadge({

  document

}) {

  const editStatus =

    document?.editApprovalStatus ||

    'NONE';

  const revision =

    Number(

      document?.revisionNo ||

      0

    );

  if (

    editStatus ===

    'PENDING'

  ) {

    return (

      <Badge

        bg="warning"

        text="dark"

        className="fw-normal"

      >

        Edit Pending

      </Badge>

    );

  }

  if (

    editStatus ===

    'REJECTED'

  ) {

    return (

      <Badge

        bg="danger"

        className="fw-normal"

      >

        Edit Rejected

      </Badge>

    );

  }

  if (

    document?.isEdited ||

    revision > 0 ||

    editStatus ===

      'APPROVED'

  ) {

    return (

      <Badge

        bg="info"

        text="dark"

        className="fw-normal"

      >

        Rev {revision}

      </Badge>

    );

  }

  return null;

}

/* =========================================================

   COMPONENT

\\========================================================= */

export default function PODetailPage() {

  const {

    id

  } = useParams();

  const {

    can

  } = useAuth();

  const [

    po,

    setPo

  ] = useState(null);

  const [

    invoices,

    setInvoices

  ] = useState([]);

  const [

    payments,

    setPayments

  ] = useState([]);

  const [

    err,

    setErr

  ] = useState('');

  const [

    loading,

    setLoading

  ] = useState(true);

  const [

    savingStatus,

    setSavingStatus

  ] = useState(false);

  const [

    showStatus,

    setShowStatus

  ] = useState(false);

  const [

    status,

    setStatus

  ] = useState({

    executionStatus:

      'IN_PROGRESS',

    actualCompletionDate:

      ''

  });

  /* =========================================================

     LOAD

  ========================================================= */

  async function load() {

    try {

      setLoading(true);

      setErr('');

      const [

        poResponse,

        invoiceResponse,

        paymentResponse

      ] =

        await Promise.all([

          api.get(

            `/pos/${id}`

          ),

          api.get(

            '/invoices',

            {

              params: {

                po: id

              }

            }

          ),

          api.get(

            '/payments',

            {

              params: {

                po: id

              }

            }

          )

        ]);

      const poData =

        poResponse.data.data;

      setPo(

        poData

      );

      setInvoices(

        invoiceResponse

          .data

          .data || []

      );

      setPayments(

        paymentResponse

          .data

          .data || []

      );

      setStatus({

        executionStatus:

          poData.executionStatus ||

          'PO_RECEIVED',

        actualCompletionDate:

          poData.actualCompletionDate

            ? String(

                poData.actualCompletionDate

              ).slice(

                0,

                10

              )

            : ''

      });

    } catch (error) {

      setErr(

        error.response?.data

          ?.message ||

          'Unable to load Customer PO.'

      );

    } finally {

      setLoading(false);

    }

  }

  useEffect(() => {

    load();

  }, [id]);

  /* =========================================================

     SAVE EXECUTION STATUS

  ========================================================= */

  async function saveStatus(

    event

  ) {

    event.preventDefault();

    try {

      setSavingStatus(true);

      setErr('');

      if (

        status.executionStatus ===

          'COMPLETED' &&

        !status.actualCompletionDate

      ) {

        setErr(

          'Actual completion date is required when the PO is completed.'

        );

        return;

      }

      await api.patch(

        `/pos/${id}/execution`,

        {

          executionStatus:

            status.executionStatus,

          actualCompletionDate:

            status.executionStatus ===

            'COMPLETED'

              ? status.actualCompletionDate

              : null

        }

      );

      setShowStatus(

        false

      );

      await load();

    } catch (error) {

      setErr(

        error.response?.data

          ?.message ||

          'Unable to update work status.'

      );

    } finally {

      setSavingStatus(

        false

      );

    }

  }

  /* =========================================================

     LOADING

  ========================================================= */

  if (

    loading &&

    !po

  ) {

    return (

      <div className="text-center py-5">

        <Spinner />

      </div>

    );

  }

  if (

    err &&

    !po

  ) {

    return (

      <Alert variant="danger">

        {err}

      </Alert>

    );

  }

  if (!po) {

    return null;

  }

  /* =========================================================

     CUSTOMER SNAPSHOT

  ========================================================= */

  const customer =

    po.customerSnapshot ||

    po.customer ||

    {};

  const financial =

    po.financialSummary ||

    {};

  /* =========================================================

     APPROVAL-AWARE TRANSACTION COUNTS

     Only APPROVED / legacy invoices are financially active.

     Pending and rejected records are still displayed below

     for operational visibility, but they do not drive the

     PO financial summary.

  ========================================================= */

  const approvedInvoices =

    invoices.filter(

      (invoice) =>

        effectiveApprovalStatus(

          invoice

        ) ===

        'APPROVED'

    );

  const pendingInvoices =

    invoices.filter(

      (invoice) =>

        effectiveApprovalStatus(

          invoice

        ) ===

        'PENDING'

    );

  const rejectedInvoices =

    invoices.filter(

      (invoice) =>

        effectiveApprovalStatus(

          invoice

        ) ===

        'REJECTED'

    );

  const approvedPayments =

    payments.filter(

      (payment) =>

        effectiveApprovalStatus(

          payment

        ) ===

        'APPROVED'

    );

  const pendingPayments =

    payments.filter(

      (payment) =>

        effectiveApprovalStatus(

          payment

        ) ===

        'PENDING'

    );

  /* =========================================================

     INVOICE MADE

     A pending/rejected invoice is not treated as financially

     active until approval.

  ========================================================= */

  const invoiceMade =

    approvedInvoices.length > 0;

  /* =========================================================

     UI

  ========================================================= */

  return (

    <>

      <PageHeader

        title={

          po.poNumber

        }

        subtitle={`${customer.name || 'Customer'}${

          customer.vendorCode

            ? ` • Vendor Code ${customer.vendorCode}`

            : ''

        }`}

        actions={

          <>

            {can('po.execution') && (

              <Button

                variant="outline-secondary"

                onClick={() =>

                  setShowStatus(

                    true

                  )

                }

              >

                <i className="bi bi-arrow-repeat me-1" />

                Update Work Status

              </Button>

            )}

            <Button

              as={Link}

              to="/invoices"

              variant="outline-primary"

            >

              <i className="bi bi-file-earmark-text me-1" />

              Invoices

            </Button>

            {po.poDocument

              ?.path && (

              <Button

                href={fileUrl(

                  po.poDocument

                    .path

                )}

                target="_blank"

                rel="noreferrer"

                className="primary-btn"

              >

                <i className="bi bi-file-earmark-pdf me-1" />

                View Customer PO

              </Button>

            )}

          </>

        }

      />

      {/* =====================================================

          ERROR

      ===================================================== */}

      {err && (

        <Alert

          variant="danger"

          dismissible

          onClose={() =>

            setErr('')

          }

        >

          {err}

        </Alert>

      )}

      {/* =====================================================

          PO EDIT APPROVAL / REVISION NOTICE

      ===================================================== */}

      {po.editApprovalStatus ===

        'PENDING' && (

        <Alert

          variant="warning"

          className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-2"

        >

          <div>

            <div className="fw-semibold">

              <i className="bi bi-clock-history me-2" />

              PO edit is waiting for approval

            </div>

            <small>

              The values shown on this page are the current approved PO values.

              Proposed changes will not become live until approval.

            </small>

          </div>

          {can('approval.view') && (

            <Button

              as={Link}

              to="/approvals"

              size="sm"

              variant="outline-dark"

              className="text-nowrap"

            >

              <i className="bi bi-shield-check me-1" />

              Open Approvals

            </Button>

          )}

        </Alert>

      )}

      {po.editApprovalStatus ===

        'REJECTED' && (

        <Alert

          variant="secondary"

        >

          <i className="bi bi-info-circle me-2" />

          The latest proposed PO edit was rejected. The currently approved PO values remain unchanged.

        </Alert>

      )}

      {/* =====================================================

          FINANCIAL SUMMARY

      ===================================================== */}

      <Row className="g-3 mb-3 tv-kpi-row">

        <Col

          md={6}

          xl={3}

        >

          <Card className="mini-metric h-100">

            <span>

              Customer PO Value

            </span>

            <b>

              {money(

                po.totalPOAmount

              )}

            </b>

          </Card>

        </Col>

        <Col

          md={6}

          xl={3}

        >

          <Card className="mini-metric h-100">

            <span>

              Invoiced

            </span>

            <b>

              {money(

                financial.totalInvoiced

              )}

            </b>

            <small className="text-muted mt-1">

              Yet to Invoice:{' '}

              {money(

                financial.uninvoicedAmount

              )}

            </small>

          </Card>

        </Col>

        <Col

          md={6}

          xl={3}

        >

          
<Card className="mini-metric h-100">
  <span>Bank Received</span>

  <b>{money(financial.totalBankReceived)}</b>

  <small className="text-muted mt-1">
    TDS: {money(financial.totalTDS)}
  </small>

  <small className="text-success mt-1">
    Total Settled: {money(
      num(financial.totalBankReceived) +
      num(financial.totalTDS)
    )}
  </small>
</Card>


        </Col>

        <Col

          md={6}

          xl={3}

        >

          <Card className="mini-metric h-100">

            <span>

              Outstanding (To Receive)

            </span>

            <b>
{money(
  Math.max(
    0,
    num(po.totalPOAmount) -
    num(financial.totalBankReceived)-
     num(financial.totalTDS)
  )
)}

            </b>

            <small className="text-muted mt-1">
  Remaining customer receivable after Bank + TDS settlement.
            </small>
          </Card>

        </Col>

      </Row>

              <POAdvanceSection

          poId={id}

          canRecord={can(['ADMIN', 'MANAGER', 'ACCOUNTS', 'PO_USER'])}

        />

        {/* PO COMPLETION - this card shows the saved backend audit */}

        <Card className="panel-card mb-3">

          <Card.Body>

            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">

              <h5 className="mb-0">PO Completion</h5>

              <StatusBadge value={po.executionStatus} />

            </div>

            <Row className="g-3">

              <Col md={4}>

                <div className="text-muted small mb-1">Actual Completion Date</div>

                <div className="fw-semibold">

                  {po.executionStatus === 'COMPLETED' && po.actualCompletionDate

                    ? date(po.actualCompletionDate) : '—'}

                </div>

              </Col>

              <Col md={4}>

                <div className="text-muted small mb-1">Completed By</div>

                <div className="fw-semibold">

                  {po.executionStatus === 'COMPLETED' ? userDisplay(po.completedBy) : '—'}

                </div>

              </Col>

              <Col md={4}>

                <div className="text-muted small mb-1">Status Updated At (Completion)</div>

                <div className="fw-semibold">

                  {po.executionStatus === 'COMPLETED' ? dateTime(po.completedAt) : '—'}

                </div>

              </Col>

            </Row>

            {po.executionStatus !== 'COMPLETED' && (

              <small className="text-muted d-block mt-3">

                Select Update Work Status above to mark this PO completed.

              </small>

            )}

          </Card.Body>

        </Card>



{/* =====================================================

          PO + CUSTOMER

      ===================================================== */}

      <Row className="g-3">

        {/* PO OVERVIEW */}

        <Col xl={5}>

          <Card className="panel-card h-100">

            <Card.Body>

              <h5 className="mb-3">

                Customer PO Overview

              </h5>

              <div className="detail-list">

                <div>

                  <span>Project</span>

                  <b>{po.project?.name

                    ? `${po.project.code || ''} — ${po.project.name}`

                    : 'Not assigned'}</b>

                </div>

                <div>

                  <span>

                    Customer PO No.

                  </span>

                  <b>

                    {

                      po.poNumber

                    }

                  </b>

                </div>

                <div>

                  <span>

                    PO Date

                  </span>

                  <b>

                    {date(

                      po.poDate

                    )}

                  </b>

                </div>

                <div>

                  <span>

                    PO Type

                  </span>

                  <b>

                    {poTypeLabel(

                      po.poType

                    )}

                  </b>

                </div>

                <div>

                  <span>GST Pricing</span>

                  <b>{po.gstPricing === 'INCLUSIVE' ? 'GST Inclusive' : po.gstPricing === 'EXCLUSIVE' ? 'GST Exclusive' : '—'}</b>

                </div>

                <div>

                  <span>

                    PO Revision

                  </span>

                  <POEditBadge

                    po={po}

                  />

                </div>

                <div>

                  <span>

                    Edit Approval

                  </span>

                  <b>

                    {po.editApprovalStatus ===

                    'PENDING'

                      ? 'Pending Approval'

                      : po.editApprovalStatus ===

                        'REJECTED'

                        ? 'Rejected'

                        : po.isEdited ||

                          Number(

                            po.revisionNo ||

                            0

                          ) > 0

                          ? 'Approved'

                          : 'No Edit'}

                  </b>

                </div>

                {/* =========================================

                    INVOICE MADE

                ========================================= */}

                <div>

                  <span>

                    Invoice Made

                  </span>

                  <Badge

                    bg={

                      invoiceMade

                        ? 'success'

                        : 'secondary'

                    }

                    className="fw-normal"

                  >

                    {invoiceMade

                      ? 'Yes'

                      : 'No'}

                  </Badge>

                </div>

                <div>

                  <span>

                    No. of Invoices

                  </span>

                  <b>

                    {

                      invoices.length

                    }

                  </b>

                </div>

                <div>

                  <span>

                    Expected Completion

                  </span>

                  <b>

                    {po.expectedCompletionDate

                      ? date(

                          po.expectedCompletionDate

                        )

                      : '—'}

                  </b>

                </div>

                <div>

                  <span>

                    Actual Completion

                  </span>

                  <b>

                    {po.actualCompletionDate

                      ? date(

                          po.actualCompletionDate

                        )

                      : '—'}

                  </b>

                </div>

                <div>

                  <span>

                    Responsible Person

                  </span>

                  <b>

                    {po.responsiblePerson

                      ?.name ||

                      '—'}

                  </b>

                </div>

              </div>

              <hr />

              <h6 className="fw-semibold mb-3">

                Status

              </h6>

              <div className="detail-list">

                <div>

                  <span>Project</span>

                  <b>{po.project?.name

                    ? `${po.project.code || ''} — ${po.project.name}`

                    : 'Not assigned'}</b>

                </div>

                <div>

                  <span>

                    Execution

                  </span>

                  <StatusBadge

                    value={

                      po.executionStatus

                    }

                  />

                </div>

                <div>

                  <span>

                    Invoice

                  </span>

                  <StatusBadge

                    value={

                      po.invoiceStatus

                    }

                  />

                </div>

                <div>

                  <span>

                    Payment

                  </span>

                  <StatusBadge

                    value={

                      po.paymentStatus

                    }

                  />

                </div>

                <div>

                  <span>

                    Overall

                  </span>

                  <StatusBadge

                    value={

                      po.overallStatus

                    }

                  />

                </div>

              </div>

            </Card.Body>

          </Card>

        </Col>

        {/* CUSTOMER */}

        <Col xl={7}>

          <Card className="panel-card h-100">

            <Card.Body>

              <h5 className="mb-3">

                Customer Information

              </h5>

              <Row className="g-3">

                <Col md={6}>

                  <small className="text-muted d-block">

                    Customer Name

                  </small>

                  <div className="fw-semibold">

                    {text(

                      customer.name

                    )}

                  </div>

                </Col>

                <Col md={3}>

                  <small className="text-muted d-block">

                    Customer Code

                  </small>

                  <div className="fw-semibold">

                    {text(

                      customer.code

                    )}

                  </div>

                </Col>

                <Col md={3}>

                  <small className="text-muted d-block">

                    Our Vendor Code

                  </small>

                  <div className="fw-semibold">

                    {text(

                      customer.vendorCode

                    )}

                  </div>

                </Col>

                <Col md={6}>

                  <small className="text-muted d-block">

                    GSTIN

                  </small>

                  <div className="fw-semibold">

                    {text(

                      customer.gstin

                    )}

                  </div>

                </Col>

                <Col md={3}>

                  <small className="text-muted d-block">

                    State

                  </small>

                  <div>

                    {text(

                      customer.state

                    )}

                  </div>

                </Col>

                <Col md={3}>

                  <small className="text-muted d-block">

                    State Code

                  </small>

                  <div>

                    {text(

                      customer.stateCode

                    )}

                  </div>

                </Col>

                <Col md={6}>

                  <small className="text-muted d-block">

                    PAN

                  </small>

                  <div>

                    {text(

                      customer.pan

                    )}

                  </div>

                </Col>

                <Col md={12}>

                  <small className="text-muted d-block">

                    Billing Address

                  </small>

                  <div>

                    {text(

                      customer.billingAddress

                    )}

                  </div>

                </Col>

                <Col md={12}>

                  <small className="text-muted d-block">

                    Shipping Address

                  </small>

                  <div>

                    {text(

                      customer.shippingAddress

                    )}

                  </div>

                </Col>

              </Row>

            </Card.Body>

          </Card>

        </Col>

      </Row>

      {/* =====================================================

          REFERENCE / DELIVERY

      ===================================================== */}

      <Row className="g-3 mt-1">

        <Col xl={6}>

          <Card className="panel-card h-100">

            <Card.Body>

              <h5 className="mb-3">

                Customer Reference

              </h5>

              <div className="detail-list">

                <div>

                  <span>Project</span>

                  <b>{po.project?.name

                    ? `${po.project.code || ''} — ${po.project.name}`

                    : 'Not assigned'}</b>

                </div>

                <div>

                  <span>

                    Responsible Person Name

                  </span>

                  <b>

                    {text(

                      po.customerBuyerName

                    )}

                  </b>

                </div>

                <div>

                  <span>

                    Buyer Contact / Code

                  </span>

                  <b>

                    {text(

                      po.customerBuyerContact

                    )}

                  </b>

                </div>

              </div>

            </Card.Body>

          </Card>

        </Col>

        <Col xl={6}>

          <Card className="panel-card h-100">

            <Card.Body>

              <h5 className="mb-3">

                Delivery &

                Completion

              </h5>

              <div className="detail-list">

                <div>

                  <span>Project</span>

                  <b>{po.project?.name

                    ? `${po.project.code || ''} — ${po.project.name}`

                    : 'Not assigned'}</b>

                </div>

                <div>

                  <span>

                    Delivery Location

                  </span>

                  <b>

                    {text(

                      po.deliveryLocation

                    )}

                  </b>

                </div>

                <div>

                  <span>

                    Delivery Terms

                  </span>

                  <b>

                    {text(

                      po.deliveryTerms

                    )}

                  </b>

                </div>

                <div>

                  <span>

                    Completion Terms

                  </span>

                  <b>

                    {text(

                      po.completionTerms

                    )}

                  </b>

                </div>

                <div>

                  <span>

                    Remarks

                  </span>

                  <b>

                    {text(

                      po.remarks

                    )}

                  </b>

                </div>

              </div>

            </Card.Body>

          </Card>

        </Col>

      </Row>

      {/* =====================================================

          PO ITEMS

      ===================================================== */}

      <Row className="g-3 mt-1">

        <Col xs={12}>

          <Card className="panel-card">

            <Card.Body>

              <div className="d-flex justify-content-between align-items-center mb-3">

                <div>

                  <h5 className="mb-1">

                    PO Line Items

                  </h5>

                  <small className="text-muted">

                    Commercial values

                    received from the

                    Customer PO.

                  </small>

                </div>

                <Badge

                  bg="light"

                  text="dark"

                  className="border fw-normal"

                >

                  {po.items?.length ||

                    0}{' '}

                  Item

                  {po.items?.length ===

                  1

                    ? ''

                    : 's'}

                </Badge>

              </div>

              <div className="table-responsive">

                <Table

                  size="sm"

                  className="align-middle"

                >

                  <thead>

                    <tr>

                      <th>

                        Pos.

                      </th>

                      <th>

                        Code

                      </th>

                      <th>

                        Description

                      </th>

                      <th>

                        HSN / SAC

                      </th>

                      <th>

                        UOM

                      </th>

                      <th className="text-end">

                        Qty

                      </th>

                      <th className="text-end">

                        Rate

                      </th>

                      <th className="text-end">

                        Discount

                      </th>

                      <th className="text-end">

                        Taxable

                      </th>

                      <th>

                        GST

                      </th>

                      <th className="text-end">

                        Tax

                      </th>

                      <th className="text-end">

                        Total

                      </th>

                    </tr>

                  </thead>

                  <tbody>

                    {(po.items ||

                      []).map(

                      (

                        item,

                        index

                      ) => (

                        <tr

                          key={

                            item._id ||

                            index

                          }

                        >

                          <td>

                            {text(

                              item.positionNo

                            )}

                          </td>

                          <td className="fw-semibold">

                            {text(

                              item.itemCode

                            )}

                          </td>

                          <td

                            style={{

                              minWidth:

                                250

                            }}

                          >

                            {

                              item.description

                            }

                          </td>

                          <td>

                            {text(

                              item.hsnSac

                            )}

                          </td>

                          <td>

                            {item.uom ||

                              'EA'}

                          </td>

                          <td className="text-end">

                            {

                              item.quantity

                            }

                          </td>

                          <td className="text-end text-nowrap">

                            {money(

                              item.rate

                            )}

                          </td>

                          <td className="text-end text-nowrap">

                            {num(

                              item.discountAmount

                            ) >

                            0 ? (

                              <>

                                {money(

                                  item.discountAmount

                                )}

                                {num(

                                  item.discountPercent

                                ) >

                                  0 && (

                                  <small className="d-block text-muted">

                                    {

                                      item.discountPercent

                                    }

                                    %

                                  </small>

                                )}

                              </>

                            ) : num(

                                item.discountPercent

                              ) >

                              0 ? (

                              `${item.discountPercent}%`

                            ) : (

                              '—'

                            )}

                          </td>

                          <td className="text-end text-nowrap">

                            {money(

                              item.poAmount

                            )}

                          </td>

                          <td className="text-nowrap">

                            {num(

                              item.cgstRate

                            ) >

                              0 && (

                              <small className="d-block">

                                CGST{' '}

                                {

                                  item.cgstRate

                                }

                                %

                              </small>

                            )}

                            {num(

                              item.sgstRate

                            ) >

                              0 && (

                              <small className="d-block">

                                SGST{' '}

                                {

                                  item.sgstRate

                                }

                                %

                              </small>

                            )}

                            {num(

                              item.igstRate

                            ) >

                              0 && (

                              <small className="d-block">

                                IGST{' '}

                                {

                                  item.igstRate

                                }

                                %

                              </small>

                            )}

                            {num(

                              item.cessRate

                            ) >

                              0 && (

                              <small className="d-block">

                                Cess{' '}

                                {

                                  item.cessRate

                                }

                                %

                              </small>

                            )}

                            {num(

                              item.cgstRate

                            ) ===

                              0 &&

                              num(

                                item.sgstRate

                              ) ===

                                0 &&

                              num(

                                item.igstRate

                              ) ===

                                0 &&

                              num(

                                item.cessRate

                              ) ===

                                0 &&

                              '—'}

                          </td>

                          <td className="text-end text-nowrap">

                            {money(

                              item.taxAmount

                            )}

                          </td>

                          <td className="text-end text-nowrap fw-semibold">

                            {money(

                              item.totalAmount

                            )}

                          </td>

                        </tr>

                      )

                    )}

                  </tbody>

                </Table>

              </div>

              <Row className="justify-content-end mt-3">

                <Col

                  md={6}

                  lg={5}

                  xl={4}

                >

                  <div className="totals-box">

                    <div>

                      <span>

                        PO / Taxable

                        Amount

                      </span>

                      <b>

                        {money(

                          po.poAmount

                        )}

                      </b>

                    </div>

                    {num(

                      po.discountAmount

                    ) > 0 && (

                      <div>

                        <span>

                          Discount

                        </span>

                        <b>

                          -

                          {money(

                            po.discountAmount

                          )}

                        </b>

                      </div>

                    )}

                    {num(

                      po.cgstAmount

                    ) > 0 && (

                      <div>

                        <span>

                          CGST

                        </span>

                        <b>

                          {money(

                            po.cgstAmount

                          )}

                        </b>

                      </div>

                    )}

                    {num(

                      po.sgstAmount

                    ) > 0 && (

                      <div>

                        <span>

                          SGST

                        </span>

                        <b>

                          {money(

                            po.sgstAmount

                          )}

                        </b>

                      </div>

                    )}

                    {num(

                      po.igstAmount

                    ) > 0 && (

                      <div>

                        <span>

                          IGST

                        </span>

                        <b>

                          {money(

                            po.igstAmount

                          )}

                        </b>

                      </div>

                    )}

                    {num(

                      po.cessAmount

                    ) > 0 && (

                      <div>

                        <span>

                          Cess

                        </span>

                        <b>

                          {money(

                            po.cessAmount

                          )}

                        </b>

                      </div>

                    )}

                    <div>

                      <span>

                        GST / Tax

                      </span>

                      <b>

                        {money(

                          po.gstTaxAmount

                        )}

                      </b>

                    </div>

                    {num(

                      po.roundOffAmount

                    ) !==

                      0 && (

                      <div>

                        <span>

                          Round Off

                        </span>

                        <b>

                          {money(

                            po.roundOffAmount

                          )}

                        </b>

                      </div>

                    )}

                    <div className="grand">

                      <span>

                        Total Customer

                        PO

                      </span>

                      <b>

                        {money(

                          po.totalPOAmount

                        )}

                      </b>

                    </div>

                  </div>

                </Col>

              </Row>

            </Card.Body>

          </Card>

        </Col>

      </Row>

      {/* =====================================================

          TALLY INVOICES

      ===================================================== */}

      <Row className="g-3 mt-1">

        <Col xs={12}>

          <Card className="panel-card">

            <Card.Body>

              <div className="d-flex justify-content-between align-items-center mb-3">

                <div>

                  <h5 className="mb-1">

                    Tally Invoices

                  </h5>

                  <small className="text-muted">

                    Invoices generated

                    externally in Tally

                    and registered

                    against this

                    Customer PO.

                  </small>

                </div>

                <div className="d-flex flex-wrap gap-2 align-items-center">

                  <Badge

                    bg={

                      invoiceMade

                        ? 'success'

                        : 'secondary'

                    }

                    className="fw-normal"

                  >

                    Invoice Made:{' '}

                    {invoiceMade

                      ? 'Yes'

                      : 'No'}

                  </Badge>

                  <Badge

                    bg="success"

                    className="fw-normal"

                  >

                    Approved: {approvedInvoices.length}

                  </Badge>

                  {pendingInvoices.length > 0 && (

                    <Badge

                      bg="warning"

                      text="dark"

                      className="fw-normal"

                    >

                      Pending: {pendingInvoices.length}

                    </Badge>

                  )}

                  {rejectedInvoices.length > 0 && (

                    <Badge

                      bg="danger"

                      className="fw-normal"

                    >

                      Rejected: {rejectedInvoices.length}

                    </Badge>

                  )}

                  <Badge

                    bg="light"

                    text="dark"

                    className="border fw-normal"

                  >

                    Registered: {invoices.length}

                  </Badge>

                </div>

              </div>

              <div className="table-responsive">

                <Table

                  size="sm"

                  className="align-middle"

                >

                  <thead>

                    <tr>

                      <th>

                        Invoice No.

                      </th>

                      <th>

                        Invoice Date

                      </th>

                      <th>

                        Due Date

                      </th>

                      <th className="text-end">

                        Invoice Amount

                      </th>

                      <th className="text-end">

                        GST / Tax

                      </th>

                      <th className="text-end">

                        Total Invoice

                      </th>

                      <th className="text-end">

                        Settled

                      </th>

                      <th className="text-end">

                        Outstanding

                      </th>

                      <th>

                        Approval

                      </th>

                      <th>

                        Revision

                      </th>

                      <th>

                        Payment Status

                      </th>

                      <th>

                        Document

                      </th>

                    </tr>

                  </thead>

                  <tbody>

                    {invoices.length ? (

                      invoices.map(

                        (

                          invoice

                        ) => (

                          <tr

                            key={

                              invoice._id

                            }

                          >

                            <td className="fw-semibold">

                              {

                                invoice.invoiceNumber

                              }

                            </td>

                            <td className="text-nowrap">

                              {date(

                                invoice.invoiceDate

                              )}

                            </td>

                            <td className="text-nowrap">

                              {invoice.invoiceDueDate

                                ? date(

                                    invoice.invoiceDueDate

                                  )

                                : '—'}

                            </td>

                            <td className="text-end text-nowrap">

                              {money(

                                invoice.invoiceAmount

                              )}

                            </td>

                            <td className="text-end text-nowrap">

                              {money(

                                invoice.gstTaxAmount

                              )}

                            </td>

                            <td className="text-end text-nowrap fw-semibold">

                              {money(

                                invoice.totalInvoiceAmount

                              )}

                            </td>

                            <td className="text-end text-nowrap">

                              {effectiveApprovalStatus(

                                invoice

                              ) ===

                              'APPROVED'

                                ? money(

                                    invoice.paidAmount

                                  )

                                : '—'}

                            </td>

                            <td className="text-end text-nowrap fw-semibold">

                              {effectiveApprovalStatus(

                                invoice

                              ) ===

                              'APPROVED'

                                ? money(

                                    invoice.outstandingAmount

                                  )

                                : '—'}

                            </td>

                            <td>

                              <ApprovalBadge

                                status={

                                  effectiveApprovalStatus(

                                    invoice

                                  )

                                }

                              />

                            </td>

                            <td>

                              <EditRevisionBadge

                                document={invoice}

                              />

                            </td>

                            <td>

                              {effectiveApprovalStatus(

                                invoice

                              ) ===

                              'APPROVED' ? (

                                <StatusBadge

                                  value={

                                    invoice.paymentStatus

                                  }

                                />

                              ) : (

                                <span className="text-muted small">

                                  Not Financially Active

                                </span>

                              )}

                            </td>

                            <td>

                              {invoice

                                .invoiceDocument

                                ?.path ? (

                                <Button

                                  size="sm"

                                  variant="outline-primary"

                                  href={fileUrl(

                                    invoice

                                      .invoiceDocument

                                      .path

                                  )}

                                  target="_blank"

                                  rel="noreferrer"

                                  className="text-nowrap"

                                >

                                  <i className="bi bi-eye me-1" />

                                  View

                                </Button>

                              ) : (

                                <span className="text-muted">

                                  —

                                </span>

                              )}

                            </td>

                          </tr>

                        )

                      )

                    ) : (

                      <tr>

                        <td

                          colSpan="12"

                          className="text-center py-4 text-muted"

                        >

                          No approved Tally invoice is financially active against this PO.

                        </td>

                      </tr>

                    )}

                  </tbody>

                </Table>

              </div>

            </Card.Body>

          </Card>

        </Col>

      </Row>

      {/* =====================================================

          PAYMENTS

      ===================================================== */}

      <Row className="g-3 mt-1">

        <Col xs={12}>

          <Card className="panel-card">

            <Card.Body>

              <div className="d-flex justify-content-between align-items-center mb-3">

                <h5 className="mb-0">

                  Payments /

                  Advances

                </h5>

                <div className="d-flex flex-wrap gap-2">

                  <Badge

                    bg="success"

                    className="fw-normal"

                  >

                    Approved: {approvedPayments.length}

                  </Badge>

                  {pendingPayments.length > 0 && (

                    <Badge

                      bg="warning"

                      text="dark"

                      className="fw-normal"

                    >

                      Pending: {pendingPayments.length}

                    </Badge>

                  )}

                  <Badge

                    bg="light"

                    text="dark"

                    className="border fw-normal"

                  >

                    Registered: {payments.length}

                  </Badge>

                </div>

              </div>

              <div className="payment-feed">

                {payments.length ? (

                  payments.map(

                    (

                      payment

                    ) => (

                      <div

                        key={

                          payment._id

                        }

                      >

                        <div>

                          <div className="d-flex flex-wrap align-items-center gap-2">

                            <b>

                              {money(

                                payment.netAmountReceived

                              )}

                            </b>

                            <ApprovalBadge

                              status={

                                effectiveApprovalStatus(

                                  payment

                                )

                              }

                            />

                            <EditRevisionBadge

                              document={payment}

                            />

                          </div>

                          <small>

                            {date(

                              payment.paymentDate

                            )}

                            {' • '}

                            {payment.paymentReferenceUTR ||

                              'No UTR'}

                            {num(

                              payment.tdsDeductions

                            ) >

                              0 && (

                              <>

                                {' • '}

                                TDS{' '}

                                {money(

                                  payment.tdsDeductions

                                )}

                              </>

                            )}

                            {effectiveApprovalStatus(

                              payment

                            ) !==

                              'APPROVED' && (

                              <>

                                {' • '}

                                Not included in financial summary

                              </>

                            )}

                          </small>

                        </div>

                        <Badge

                          bg={

                            payment.paymentType ===

                            'ADVANCE'

                              ? 'info'

                              : 'success'

                          }

                          className="fw-normal"

                        >

                          {payment.paymentType ===

                          'ADVANCE'

                            ? 'Advance'

                            : 'Invoice Payment'}

                        </Badge>

                      </div>

                    )

                  )

                ) : (

                  <p className="text-muted mb-0">

                    No payments

                    received.

                  </p>

                )}

              </div>

            </Card.Body>

          </Card>

        </Col>

      </Row>

      {/* =====================================================

          STATUS MODAL

      ===================================================== */}

      <Modal

        show={

          showStatus

        }

        onHide={() =>

          !savingStatus &&

          setShowStatus(

            false

          )

        }

        centered

        backdrop="static"

      >

        <Form

          onSubmit={

            saveStatus

          }

        >

          <Modal.Header

            closeButton

          >

            <Modal.Title>

              Update Work /

              Service Status

            </Modal.Title>

          </Modal.Header>

          <Modal.Body>

            <Form.Label>

              Execution Status

            </Form.Label>

            <Form.Select

              required

              value={

                status.executionStatus

              }

              onChange={(e) =>

                setStatus(

                  (prev) => ({

                    ...prev,

                    executionStatus:

                      e.target

                        .value,

                    actualCompletionDate:

                      e.target

                        .value ===

                      'COMPLETED'

                        ? prev.actualCompletionDate

                        : ''

                  })

                )

              }

            >

              <option value="PO_RECEIVED">

                PO Received

              </option>

              <option value="IN_PROGRESS">

                In Progress

              </option>

              <option value="PARTIALLY_COMPLETED">

                Partially

                Completed

              </option>

              <option value="COMPLETED">

                Completed

              </option>

              <option value="CANCELLED">

                Cancelled

              </option>

            </Form.Select>

            {status.executionStatus ===

              'COMPLETED' && (

              <>

                <Form.Label className="mt-3">

                  Actual

                  Completion Date

                  *

                </Form.Label>

                <Form.Control

                  required

                  type="date"

                  value={

                    status.actualCompletionDate

                  }

                  onChange={(e) =>

                    setStatus(

                      (prev) => ({

                        ...prev,

                        actualCompletionDate:

                          e.target

                            .value

                      })

                    )

                  }

                />

              </>

            )}

            {po.invoiceStatus !==

              'NOT_INVOICED' &&

              status.executionStatus ===

                'CANCELLED' && (

                <Alert

                  variant="warning"

                  className="mt-3 mb-0"

                >

                  This PO already

                  has invoice

                  activity.

                  Cancellation may

                  be blocked.

                </Alert>

              )}

          </Modal.Body>

          <Modal.Footer>

            <Button

              type="button"

              variant="light"

              disabled={

                savingStatus

              }

              onClick={() =>

                setShowStatus(

                  false

                )

              }

            >

              Cancel

            </Button>

            <Button

              className="primary-btn"

              type="submit"

              disabled={

                savingStatus

              }

            >

              {savingStatus

                ? 'Updating...'

                : 'Update Status'}

            </Button>

          </Modal.Footer>

        </Form>

      </Modal>

    </>

  );

}
