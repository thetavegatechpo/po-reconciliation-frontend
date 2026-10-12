import {
  useEffect,
  useMemo,
  useState
} from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Form,
  InputGroup,
  Row,
  Spinner,
  Table
} from 'react-bootstrap';
import {
  Link,
  useSearchParams
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
import { useAuth } from '../context/AuthContext';
/* =========================================================
   PO LIST
\\========================================================= */
export default function POListPage() {
  const {
    can
  } = useAuth();
  const [
    params,
    setParams
  ] = useSearchParams();
  const [
    data,
    setData
  ] = useState([]);
  const [
    loading,
    setLoading
  ] = useState(true);
  const [
    err,
    setErr
  ] = useState('');
  /* =========================================================
     FILTER VALUES
  ========================================================= */
  const query = useMemo(
    () => ({
      search:
        params.get('search') ||
        '',
      executionStatus:
        params.get(
          'executionStatus'
        ) || '',
      invoiceStatus:
        params.get(
          'invoiceStatus'
        ) || '',
      paymentStatus:
        params.get(
          'paymentStatus'
        ) || '',
      /* NEW */
      editApprovalStatus:
        params.get(
          'editApprovalStatus'
        ) || '',
      fromDate:
        params.get(
          'fromDate'
        ) || '',
      toDate:
        params.get(
          'toDate'
        ) || '',
      completionFrom:
        params.get(
          'completionFrom'
        ) || '',
      completionTo:
        params.get(
          'completionTo'
        ) || ''
    }),
    [params]
  );
  /* =========================================================
     LOAD
  ========================================================= */
  async function load() {
    try {
      setLoading(true);
      setErr('');
      const response =
        await api.get(
          '/pos',
          {
            params: query
          }
        );
      setData(
        response.data.data ||
        []
      );
    } catch (error) {
      setErr(
        error.response?.data
          ?.message ||
        'Unable to load Customer POs.'
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [
    params.toString()
  ]);
  /* =========================================================
     SET FILTER
  ========================================================= */
  function setFilter(
    key,
    value
  ) {
    const next =
      new URLSearchParams(
        params
      );
    if (value) {
      next.set(
        key,
        value
      );
    } else {
      next.delete(
        key
      );
    }
    setParams(
      next
    );
  }
  /* =========================================================
     CLEAR FILTERS
  ========================================================= */
  function clearFilters() {
    setParams(
      new URLSearchParams()
    );
  }
  const hasFilters =
    Object.values(
      query
    ).some(
      Boolean
    );
  /* =========================================================
     CUSTOMER HELPERS
  ========================================================= */
  function customerName(
    po
  ) {
    return (
      po.customerSnapshot
        ?.name ||
      po.customer?.name ||
      '—'
    );
  }
  function customerCode(
    po
  ) {
    return (
      po.customerSnapshot
        ?.code ||
      po.customer?.code ||
      ''
    );
  }
  function vendorCode(
    po
  ) {
    return (
      po.customerSnapshot
        ?.vendorCode ||
      po.customer
        ?.vendorCode ||
      ''
    );
  }
  /* =========================================================
     INVOICE MADE
     IMPORTANT:
     This continues using APPROVED financial data because
     reconciliation now excludes pending/rejected invoices.
     Therefore:
     Pending Invoice only
     =
     Invoice Made = NO
     Approved Invoice
     =
     Invoice Made = YES
  ========================================================= */
  function invoiceMade(
    po
  ) {
    const totalInvoiced =
      Number(
        po
          .financialSummary
          ?.totalInvoiced ||
        0
      );
    return (
      totalInvoiced > 0 ||
      (
        po.invoiceStatus &&
        po.invoiceStatus !==
          'NOT_INVOICED'
      )
    );
  }
  /* =========================================================
     COMPLETION DATE
  ========================================================= */
  function completionDate(
    po
  ) {
    return (
      po.actualCompletionDate ||
      po.expectedCompletionDate
    );
  }
  /* =========================================================
     PO EDIT / REVISION BADGE
     NEW PO
     → nothing
     Edit submitted
     → EDIT PENDING
     Approved edit
     → EDITED • REV 1
     Rejected edit
     → EDIT REJECTED
     If PO already had approved revisions and latest new
     amendment is rejected, current revision is also shown.
  ========================================================= */
  function POEditStatus({
    po
  }) {
    const status =
      po.editApprovalStatus ||
      'NONE';
    const revision =
      Number(
        po.revisionNo ||
        0
      );
    if (
      status ===
      'PENDING'
    ) {
      return (
        <div className="d-flex flex-wrap gap-1 mt-1">
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
              Rev {revision}
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
        <div className="d-flex flex-wrap gap-1 mt-1">
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
      po.isEdited ||
      revision > 0 ||
      status ===
        'APPROVED'
    ) {
      return (
        <div className="mt-1">
          <Badge
            bg="info"
            text="dark"
            className="fw-normal"
          >
            <i className="bi bi-pencil-square me-1" />
            Edited • Rev {revision}
          </Badge>
        </div>
      );
    }
    return null;
  }
  /* =========================================================
     UI
  ========================================================= */
  return (
    <>
      <PageHeader
        title="Customer PO Management"
        subtitle="Track every Customer PO from receipt, execution and invoicing through payment and closure."
        actions={
          can('po.create') ? (
            <Button
              as={Link}
              to="/pos/new"
              className="primary-btn"
            >
              <i className="bi bi-plus-lg me-2" />
              New Customer PO
            </Button>
          ) : null
        }
      />
      {/* =====================================================
          FILTERS
      ===================================================== */}
      <Card className="filter-card mb-3">
        <Card.Body>
          <Row className="g-2">
            {/* SEARCH */}
            <Col
              xs={12}
              lg={4}
            >
              <InputGroup>
                <InputGroup.Text>
                  <i className="bi bi-search" />
                </InputGroup.Text>
                <Form.Control
                  placeholder="Search PO, customer, vendor code or item..."
                  value={
                    query.search
                  }
                  onChange={(e) =>
                    setFilter(
                      'search',
                      e.target.value
                    )
                  }
                />
              </InputGroup>
            </Col>
            {/* EXECUTION */}
            <Col
              md={6}
              lg={2}
            >
              <Form.Select
                value={
                  query.executionStatus
                }
                onChange={(e) =>
                  setFilter(
                    'executionStatus',
                    e.target.value
                  )
                }
              >
                <option value="">
                  All Execution
                </option>
                <option value="PO_RECEIVED">
                  PO Received
                </option>
                <option value="IN_PROGRESS">
                  In Progress
                </option>
                <option value="PARTIALLY_COMPLETED">
                  Partially Completed
                </option>
                <option value="COMPLETED">
                  Completed
                </option>
                <option value="CANCELLED">
                  Cancelled
                </option>
              </Form.Select>
            </Col>
            {/* INVOICE */}
            <Col
              md={6}
              lg={2}
            >
              <Form.Select
                value={
                  query.invoiceStatus
                }
                onChange={(e) =>
                  setFilter(
                    'invoiceStatus',
                    e.target.value
                  )
                }
              >
                <option value="">
                  All Invoicing
                </option>
                <option value="NOT_INVOICED">
                  Not Invoiced
                </option>
                <option value="PARTIALLY_INVOICED">
                  Partially Invoiced
                </option>
                <option value="FULLY_INVOICED">
                  Fully Invoiced
                </option>
              </Form.Select>
            </Col>
            {/* PAYMENT */}
            <Col
              md={6}
              lg={2}
            >
              <Form.Select
                value={
                  query.paymentStatus
                }
                onChange={(e) =>
                  setFilter(
                    'paymentStatus',
                    e.target.value
                  )
                }
              >
                <option value="">
                  All Payments
                </option>
                <option value="NOT_DUE">
                  Not Due
                </option>
                <option value="PAYMENT_PENDING">
                  Payment Pending
                </option>
                <option value="PARTIALLY_PAID">
                  Partially Paid
                </option>
                <option value="PAID">
                  Paid
                </option>
                <option value="OVERDUE">
                  Overdue
                </option>
              </Form.Select>
            </Col>
            {/* =================================================
                NEW - PO EDIT APPROVAL FILTER
            ================================================= */}
            <Col
              md={6}
              lg={2}
            >
              <Form.Select
                value={
                  query.editApprovalStatus
                }
                onChange={(e) =>
                  setFilter(
                    'editApprovalStatus',
                    e.target.value
                  )
                }
              >
                <option value="">
                  All PO Edits
                </option>
                <option value="PENDING">
                  Edit Pending
                </option>
                <option value="APPROVED">
                  Edit Approved
                </option>
                <option value="REJECTED">
                  Edit Rejected
                </option>
              </Form.Select>
            </Col>
            {/* PO DATE FROM */}
            <Col
              md={6}
              lg={3}
            >
              <Form.Label className="small text-muted mb-1">
                PO Date From
              </Form.Label>
              <Form.Control
                type="date"
                value={
                  query.fromDate
                }
                onChange={(e) =>
                  setFilter(
                    'fromDate',
                    e.target.value
                  )
                }
              />
            </Col>
            {/* PO DATE TO */}
            <Col
              md={6}
              lg={3}
            >
              <Form.Label className="small text-muted mb-1">
                PO Date To
              </Form.Label>
              <Form.Control
                type="date"
                value={
                  query.toDate
                }
                onChange={(e) =>
                  setFilter(
                    'toDate',
                    e.target.value
                  )
                }
              />
            </Col>
            {/* COMPLETION FROM */}
            <Col
              md={6}
              lg={3}
            >
              <Form.Label className="small text-muted mb-1">
                Completion From
              </Form.Label>
              <Form.Control
                type="date"
                value={
                  query.completionFrom
                }
                onChange={(e) =>
                  setFilter(
                    'completionFrom',
                    e.target.value
                  )
                }
              />
            </Col>
            {/* COMPLETION TO */}
            <Col
              md={6}
              lg={3}
            >
              <Form.Label className="small text-muted mb-1">
                Completion To
              </Form.Label>
              <Form.Control
                type="date"
                value={
                  query.completionTo
                }
                onChange={(e) =>
                  setFilter(
                    'completionTo',
                    e.target.value
                  )
                }
              />
            </Col>
            {hasFilters && (
              <Col
                xs={12}
                className="text-end mt-3"
              >
                <Button
                  type="button"
                  size="sm"
                  variant="outline-secondary"
                  onClick={
                    clearFilters
                  }
                >
                  <i className="bi bi-x-circle me-1" />
                  Clear Filters
                </Button>
              </Col>
            )}
          </Row>
        </Card.Body>
      </Card>
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
          TABLE
      ===================================================== */}
      <Card className="table-card">
        <div className="table-responsive">
          <Table
            hover
            className="business-table mb-0 align-middle"
          >
            <thead>
              <tr>
                <th>
                  Customer PO
                </th>
                <th>
                  PO Date
                </th>
                <th>
                  Customer
                </th>
                <th className="text-end">
                  PO Value
                </th>
                <th>
                  Invoice Made
                </th>
                <th className="text-end">
                  Invoiced
                </th>
                <th className="text-end">
                  Yet to Invoice
                </th>
                <th className="text-end">
                  Received
                </th>
                <th className="text-end">
                  Outstanding
                </th>
                <th>
                  Completion
                </th>
                <th>
                  Execution
                </th>
                <th>
                  Invoice
                </th>
                <th>
                  Payment
                </th>
                <th>
                  Document
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan="15"
                    className="text-center py-5"
                  >
                    <Spinner
                      size="sm"
                      className="me-2"
                    />
                    Loading Customer POs...
                  </td>
                </tr>
              ) : data.length ===
                0 ? (
                <tr>
                  <td
                    colSpan="15"
                    className="text-center py-5 text-muted"
                  >
                    No Customer POs found.
                  </td>
                </tr>
              ) : (
                data.map(
                  (po) => (
                    <tr
                      key={
                        po._id
                      }
                    >
                      {/* =====================================
                          PO NUMBER + APPROVAL STATUS
                      ===================================== */}
                      <td
                        style={{
                          minWidth: 180
                        }}
                      >
                        <div className="fw-semibold">
                          {po.poNumber}
                        </div>
                        {po.poType && (
                          <small className="text-muted d-block">
                            {po.poType ===
                            'MATERIAL_AND_SERVICE'
                              ? 'Material + Service'
                              : po.poType}
                          </small>
                        )}
                        {/* NEW */}
                        <POEditStatus
                          po={po}
                        />
                      </td>
                      {/* =====================================
                          PO DATE
                      ===================================== */}
                      <td className="text-nowrap">
                        {date(
                          po.poDate
                        )}
                      </td>
                      {/* =====================================
                          CUSTOMER
                      ===================================== */}
                      <td
                        style={{
                          minWidth: 190
                        }}
                      >
                        <div className="fw-semibold">
                          {customerName(
                            po
                          )}
                        </div>
                        {customerCode(
                          po
                        ) && (
                          <small className="text-muted d-block">
                            Code:{' '}
                            {customerCode(
                              po
                            )}
                          </small>
                        )}
                        {vendorCode(
                          po
                        ) && (
                          <small className="text-muted d-block">
                            Vendor Code:{' '}
                            {vendorCode(
                              po
                            )}
                          </small>
                        )}
                      </td>
                      {/* =====================================
                          PO VALUE
                      ===================================== */}
                      <td className="text-end text-nowrap fw-semibold">
                        {money(
                          po.totalPOAmount
                        )}
                      </td>
                      {/* =====================================
                          INVOICE MADE
                      ===================================== */}
                      <td>
                        <Badge
                          bg={
                            invoiceMade(
                              po
                            )
                              ? 'success'
                              : 'secondary'
                          }
                          className="fw-normal"
                        >
                          {invoiceMade(
                            po
                          )
                            ? 'Yes'
                            : 'No'}
                        </Badge>
                      </td>
                      {/* =====================================
                          INVOICED
                      ===================================== */}
                      <td className="text-end text-nowrap">
                        {money(
                          po
                            .financialSummary
                            ?.totalInvoiced
                        )}
                      </td>
                      {/* =====================================
                          YET TO INVOICE
                      ===================================== */}
                      <td className="text-end text-nowrap">
                        {money(
                          po
                            .financialSummary
                            ?.uninvoicedAmount
                        )}
                      </td>
                      {/* =====================================
                          BANK RECEIVED
                          Actual bank credit only.
                          TDS is NOT added here.
                      ===================================== */}
                      <td className="text-end text-nowrap">
                        {money(
                          po
                            .financialSummary
                            ?.totalBankReceived
                        )}
                      </td>
                      {/* =====================================
                          OUTSTANDING
                      ===================================== */}
                      <td className="text-end text-nowrap fw-semibold">
                        {money(
                          po
                            .financialSummary
                            ?.totalOutstanding
                        )}
                      </td>
                      {/* =====================================
                          COMPLETION
                      ===================================== */}
                      <td className="text-nowrap">
                        {completionDate(
                          po
                        )
                          ? date(
                              completionDate(
                                po
                              )
                            )
                          : '—'}
                        {po.executionStatus === 'COMPLETED' && (
                          <small className="d-block text-muted mt-1">
                            By: {typeof po.completedBy === 'object' && po.completedBy
                              ? (po.completedBy.name || po.completedBy.email || '—')
                              : '—'}
                            {po.completedAt ? ` · ${new Date(po.completedAt).toLocaleString('en-IN', {day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'})}` : ''}
                          </small>
                        )}
                        {po.actualCompletionDate ? (
                          <small className="d-block text-success">
                            Actual
                          </small>
                        ) : po.expectedCompletionDate ? (
                          <small className="d-block text-muted">
                            Expected
                          </small>
                        ) : null}
                      </td>
                      {/* =====================================
                          EXECUTION
                      ===================================== */}
                      <td>
                        <StatusBadge
                          value={
                            po.executionStatus
                          }
                        />
                      </td>
                      {/* =====================================
                          INVOICE STATUS
                      ===================================== */}
                      <td>
                        <StatusBadge
                          value={
                            po.invoiceStatus
                          }
                        />
                      </td>
                      {/* =====================================
                          PAYMENT STATUS
                      ===================================== */}
                      <td>
                        <StatusBadge
                          value={
                            po.paymentStatus
                          }
                        />
                      </td>
                      {/* =====================================
                          PO DOCUMENT
                      ===================================== */}
                      <td>
                        {po.poDocument
                          ?.path ? (
                          <Button
                            size="sm"
                            variant="outline-primary"
                            href={fileUrl(
                              po
                                .poDocument
                                .path
                            )}
                            target="_blank"
                            rel="noreferrer"
                            className="text-nowrap"
                          >
                            <i className="bi bi-file-earmark-pdf me-1" />
                            View PO
                          </Button>
                        ) : (
                          <span className="text-muted">
                            —
                          </span>
                        )}
                      </td>
                      {/* =====================================
                          ACTION
                      ===================================== */}
                      <td className="text-end">
                        <Button
                          as={Link}
                          to={`/pos/${po._id}`}
                          size="sm"
                          variant="light"
                          title="View Customer PO"
                        >
                          <i className="bi bi-chevron-right" />
                        </Button>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </Table>
        </div>
      </Card>
    </>
  );
}
