import {
  useCallback,
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
  Modal,
  Row,
  Spinner,
  Table
} from 'react-bootstrap';

import {
  useAuth
} from '../context/AuthContext';

import api from '../api/client';





/* =========================================================
   HELPERS
========================================================= */



function formatDateTime(value) {
  if (!value) {
    return '-';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(value);
  }

  return date.toLocaleString(
    'en-IN',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }
  );
}

function formatDate(value) {
  if (!value) {
    return '-';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(value);
  }

  return date.toLocaleDateString(
    'en-IN',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }
  );
}

function formatMoney(value) {
  const n =
    Number(value);

  if (
    !Number.isFinite(n)
  ) {
    return '-';
  }

  return new Intl.NumberFormat(
    'en-IN',
    {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  ).format(n);
}

function humanize(value) {
  return String(
    value || ''
  )
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function isObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  );
}

function normalizeForCompare(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return '';
  }

  if (
    typeof value === 'object'
  ) {
    try {
      return JSON.stringify(
        value
      );
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function valuesEqual(
  oldValue,
  newValue
) {
  return (
    normalizeForCompare(
      oldValue
    ) ===
    normalizeForCompare(
      newValue
    )
  );
}

/* =========================================================
   DISPLAY VALUE

   Makes approval comparison readable.
========================================================= */

function DisplayValue({
  field,
  value
}) {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return (
      <span className="text-muted">
        -
      </span>
    );
  }

  /* MONEY */

  const moneyFields = [
    'invoiceAmount',
    'gstTaxAmount',
    'roundOffAmount',
    'totalInvoiceAmount',
    'amountReceived',
    'tdsDeductions',
    'otherDeductions',
    'netAmountReceived',
    'advanceReceived',
    'totalPOAmount',
    'poAmount',
    'discountAmount',
    'paidAmount',
    'outstandingAmount'
  ];

  if (
    moneyFields.includes(
      field
    )
  ) {
    return (
      <span>
        {formatMoney(value)}
      </span>
    );
  }

  /* PERCENT */

  if (
    field === 'gstTaxPercent'
  ) {
    return (
      <span>
        {Number(value || 0)}%
      </span>
    );
  }

  /* DATE */

  const dateFields = [
    'poDate',
    'invoiceDate',
    'invoiceDueDate',
    'paymentDate',
    'expectedCompletionDate',
    'actualCompletionDate',
    'lastEditedAt',
    'uploadedAt'
  ];

  if (
    dateFields.includes(
      field
    )
  ) {
    return (
      <span>
        {formatDate(value)}
      </span>
    );
  }

  /* BOOLEAN */

  if (
    typeof value ===
    'boolean'
  ) {
    return (
      <Badge
        bg={
          value
            ? 'success'
            : 'secondary'
        }
      >
        {value ? 'Yes' : 'No'}
      </Badge>
    );
  }

  /* ARRAY */

  if (
    Array.isArray(value)
  ) {
    if (
      value.length === 0
    ) {
      return (
        <span className="text-muted">
          None
        </span>
      );
    }

    return (
      <pre
        className="mb-0 small bg-light border rounded p-2"
        style={{
          maxHeight: 220,
          overflow: 'auto',
          whiteSpace: 'pre-wrap'
        }}
      >
        {JSON.stringify(
          value,
          null,
          2
        )}
      </pre>
    );
  }

  /* OBJECT */

  if (
    isObject(value)
  ) {
    return (
      <pre
        className="mb-0 small bg-light border rounded p-2"
        style={{
          maxHeight: 220,
          overflow: 'auto',
          whiteSpace: 'pre-wrap'
        }}
      >
        {JSON.stringify(
          value,
          null,
          2
        )}
      </pre>
    );
  }

  return (
    <span
      style={{
        wordBreak:
          'break-word'
      }}
    >
      {String(value)}
    </span>
  );
}

/* =========================================================
   BADGES
========================================================= */

function StatusBadge({
  status
}) {
  const map = {
    PENDING: 'warning',
    APPROVED: 'success',
    REJECTED: 'danger',
    CANCELLED: 'secondary'
  };

  return (
    <Badge
      bg={
        map[status] ||
        'secondary'
      }
      className="px-2 py-1"
    >
      {humanize(status)}
    </Badge>
  );
}

function EntityBadge({
  type
}) {
  const map = {
    PO: 'primary',
    INVOICE: 'info',
    PAYMENT: 'success'
  };

  return (
    <Badge
      bg={
        map[type] ||
        'secondary'
      }
    >
      {humanize(type)}
    </Badge>
  );
}

function ActionBadge({
  action
}) {
  return (
    <Badge
      bg={
        action === 'CREATE'
          ? 'dark'
          : action === 'UPDATE'
            ? 'warning'
            : 'secondary'
      }
      text={
        action === 'UPDATE'
          ? 'dark'
          : undefined
      }
    >
      {humanize(action)}
    </Badge>
  );
}

/* =========================================================
   MAIN PAGE
========================================================= */

export default function ApprovalsPage() {
  const {
    user
    
  } = useAuth();

  /* =====================================================
     STATE
  ===================================================== */

  const [
    approvals,
    setApprovals
  ] =
    useState([]);

  const [
    loading,
    setLoading
  ] =
    useState(true);

  const [
    error,
    setError
  ] =
    useState('');

  const [
    success,
    setSuccess
  ] =
    useState('');

  /* FILTERS */

  const [
    status,
    setStatus
  ] =
    useState('PENDING');

  const [
    entityType,
    setEntityType
  ] =
    useState('');

  const [
    action,
    setAction
  ] =
    useState('');

  const [
    search,
    setSearch
  ] =
    useState('');

  /* SELECTED */

  const [
    selectedApproval,
    setSelectedApproval
  ] =
    useState(null);

  const [
    detailLoading,
    setDetailLoading
  ] =
    useState(false);

  const [
    showDetail,
    setShowDetail
  ] =
    useState(false);

  /* APPROVE */

  const [
    showApprove,
    setShowApprove
  ] =
    useState(false);

  const [
    approveRemarks,
    setApproveRemarks
  ] =
    useState('');

  /* REJECT */

  const [
    showReject,
    setShowReject
  ] =
    useState(false);

  const [
    rejectRemarks,
    setRejectRemarks
  ] =
    useState('');

  const [
    processing,
    setProcessing
  ] =
    useState(false);

  /* =====================================================
     PERMISSION
  ===================================================== */

  const canReview =
    [
      'ADMIN',
      'MANAGER'
    ].includes(
      user?.role
    );

  /* =====================================================
     TOKEN
  ===================================================== */


  

  /* =====================================================
     LOAD APPROVALS
  ===================================================== */

  const loadApprovals =
  useCallback(
    async () => {
      try {
        setLoading(true);
        setError('');

        const params = {
          status,
          page: 1,
          limit: 100
        };

        if (entityType) {
          params.entityType =
            entityType;
        }

        if (action) {
          params.action =
            action;
        }

        if (search.trim()) {
          params.search =
            search.trim();
        }

        const response =
          await api.get(
            '/approvals',
            {
              params
            }
          );

        const result =
          response.data;

        setApprovals(
          Array.isArray(
            result?.data
          )
            ? result.data
            : []
        );
      } catch (err) {
        console.error(
          'Load approvals error:',
          err
        );

        setError(
          err.response?.data?.message ||
          err.message ||
          'Unable to load approvals.'
        );

        setApprovals([]);
      } finally {
        setLoading(false);
      }
    },
    [
      status,
      entityType,
      action,
      search
    ]
  );

  /* =====================================================
     INITIAL / FILTER LOAD

     Small delay for search typing.
  ===================================================== */

  useEffect(() => {
    const timer =
      setTimeout(
        () => {
          loadApprovals();
        },
        search
          ? 350
          : 0
      );

    return () =>
      clearTimeout(
        timer
      );
  }, [
    loadApprovals,
    search
  ]);

  /* =====================================================
     COUNTS
  ===================================================== */

  const counts =
    useMemo(
      () => ({
        total:
          approvals.length,

        po:
          approvals.filter(
            (item) =>
              item.entityType ===
              'PO'
          ).length,

        invoice:
          approvals.filter(
            (item) =>
              item.entityType ===
              'INVOICE'
          ).length,

        payment:
          approvals.filter(
            (item) =>
              item.entityType ===
              'PAYMENT'
          ).length
      }),
      [approvals]
    );

  /* =====================================================
     OPEN DETAIL

     Fetch complete request because list may contain only
     summary information in future.
  ===================================================== */

  async function openDetail(
    approval
  ) {
    try {
      setSelectedApproval(
        approval
      );

      setShowDetail(
        true
      );

      setDetailLoading(
        true
      );

      setError('');

    const response =
  await api.get(
    `/approvals/${approval._id}`
  );

const result =
  response.data;

      setSelectedApproval(
        result?.data ||
        approval
      );
   } catch (err) {
  console.error(
    'Load approval detail error:',
    err
  );

  setError(
    err.response?.data?.message ||
    err.message ||
    'Unable to load approval details.'
  );
}finally {
      setDetailLoading(
        false
      );
    }
  }

  /* =====================================================
     APPROVE
  ===================================================== */

  function openApproveModal(
    approval
  ) {
    setSelectedApproval(
      approval
    );

    setApproveRemarks(
      ''
    );

    setShowApprove(
      true
    );
  }

  async function approveRequest() {
    if (
      !selectedApproval?._id
    ) {
      return;
    }

    try {
      setProcessing(
        true
      );

      setError('');
      setSuccess('');

     const response =
  await api.post(
    `/approvals/${selectedApproval._id}/approve`,
    {
      remarks:
        approveRemarks.trim()
    }
  );

const result =
  response.data;

      setShowApprove(
        false
      );

      setShowDetail(
        false
      );

      setSelectedApproval(
        null
      );

      setApproveRemarks(
        ''
      );

      setSuccess(
        result?.message ||
        'Approval completed successfully.'
      );

      await loadApprovals();
  } catch (err) {
  console.error(
    'Approve request error:',
    err
  );

  setError(
    err.response?.data?.message ||
    err.message ||
    'Unable to approve request.'
  );
}  finally {
      setProcessing(
        false
      );
    }
  }

  /* =====================================================
     REJECT
  ===================================================== */

  function openRejectModal(
    approval
  ) {
    setSelectedApproval(
      approval
    );

    setRejectRemarks(
      ''
    );

    setShowReject(
      true
    );
  }

  async function rejectRequest() {
    if (
      !selectedApproval?._id
    ) {
      return;
    }

    if (
      !rejectRemarks.trim()
    ) {
      setError(
        'Rejection remarks are required.'
      );

      return;
    }

    try {
      setProcessing(
        true
      );

      setError('');
      setSuccess('');

     const response =
  await api.post(
    `/approvals/${selectedApproval._id}/reject`,
    {
      remarks:
        rejectRemarks.trim()
    }
  );

const result =
  response.data;

      setShowReject(
        false
      );

      setShowDetail(
        false
      );

      setSelectedApproval(
        null
      );

      setRejectRemarks(
        ''
      );

      setSuccess(
        result?.message ||
        'Request rejected successfully.'
      );

      await loadApprovals();
  } catch (err) {
  console.error(
    'Reject request error:',
    err
  );

  setError(
    err.response?.data?.message ||
    err.message ||
    'Unable to reject request.'
  );
}finally {
      setProcessing(
        false
      );
    }
  }

  /* =====================================================
     COMPARISON FIELDS
  ===================================================== */

  const comparisonFields =
    useMemo(() => {
      if (
        !selectedApproval
      ) {
        return [];
      }

      const oldData =
        selectedApproval.oldData ||
        {};

      const proposedData =
        selectedApproval.proposedData ||
        {};

      const keys =
        new Set([
          ...Object.keys(
            oldData
          ),

          ...Object.keys(
            proposedData
          )
        ]);

      /*
        Hide internal fields that do not help the reviewer.
      */

      const hidden = [
        '_id',
        '__v',
        'createdAt',
        'updatedAt',
        'approvalStatus',
        'editApprovalStatus',
        'approvalRequest',
        'pendingEditApprovalRequest',
        'createdBy',
        'updatedBy'
      ];

      return Array.from(
        keys
      )
        .filter(
          (key) =>
            !hidden.includes(
              key
            )
        )
        .map(
          (key) => ({
            key,

            oldValue:
              oldData[
                key
              ],

            newValue:
              proposedData[
                key
              ],

            changed:
              !valuesEqual(
                oldData[key],
                proposedData[key]
              )
          })
        )
        .sort(
          (a, b) => {
            /*
              Changed fields first.
            */

            if (
              a.changed &&
              !b.changed
            ) {
              return -1;
            }

            if (
              !a.changed &&
              b.changed
            ) {
              return 1;
            }

            return a.key.localeCompare(
              b.key
            );
          }
        );
    }, [
      selectedApproval
    ]);

  /* =====================================================
     CREATE REQUEST SPECIAL CASE

     CREATE has no oldData.

     Show only proposed data.
  ===================================================== */

  const isCreateRequest =
    selectedApproval?.action ===
    'CREATE';

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <div className="container-fluid py-3 py-lg-4">

      {/* ===================================================
          HEADER
      =================================================== */}

      <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-4">

        <div>
          <div className="d-flex align-items-center gap-2 mb-1">

            <div
              className="d-flex align-items-center justify-content-center rounded-3 bg-primary-subtle text-primary"
              style={{
                width: 44,
                height: 44
              }}
            >
              <i className="bi bi-shield-check fs-5" />
            </div>

            <div>
              <h4 className="mb-0">
                Approvals
              </h4>

              <div className="text-muted small">
                PO amendments, invoices and payment receipts
              </div>
            </div>

          </div>
        </div>

        <div className="d-flex align-items-center gap-2">

          <Badge
            bg={
              status === 'PENDING'
                ? 'warning'
                : 'secondary'
            }
            text={
              status === 'PENDING'
                ? 'dark'
                : undefined
            }
            className="px-3 py-2"
          >
            {counts.total}{' '}
            {humanize(status)}
          </Badge>

          <Button
            variant="outline-secondary"
            onClick={
              loadApprovals
            }
            disabled={
              loading
            }
          >
            <i className="bi bi-arrow-clockwise me-2" />

            Refresh
          </Button>

        </div>

      </div>

      {/* ===================================================
          ALERTS
      =================================================== */}

      {error && (
        <Alert
          variant="danger"
          dismissible
          onClose={() =>
            setError('')
          }
        >
          <i className="bi bi-exclamation-triangle me-2" />

          {error}
        </Alert>
      )}

      {success && (
        <Alert
          variant="success"
          dismissible
          onClose={() =>
            setSuccess('')
          }
        >
          <i className="bi bi-check-circle me-2" />

          {success}
        </Alert>
      )}

      {/* ===================================================
          STATUS TABS
      =================================================== */}

      <Card className="border-0 shadow-sm mb-3">
        <Card.Body className="p-2">

          <div className="d-flex flex-wrap gap-2">

            {[
              [
                'PENDING',
                'Pending',
                'bi-clock-history'
              ],

              [
                'APPROVED',
                'Approved',
                'bi-check-circle'
              ],

              [
                'REJECTED',
                'Rejected',
                'bi-x-circle'
              ]
            ].map(
              ([
                value,
                label,
                icon
              ]) => (
                <Button
                  key={value}
                  variant={
                    status ===
                    value
                      ? value ===
                        'PENDING'
                        ? 'warning'
                        : value ===
                          'APPROVED'
                          ? 'success'
                          : 'danger'
                      : 'light'
                  }
                  className="px-3"
                  onClick={() => {
                    setStatus(
                      value
                    );

                    setSuccess(
                      ''
                    );

                    setError(
                      ''
                    );
                  }}
                >
                  <i
                    className={`bi ${icon} me-2`}
                  />

                  {label}
                </Button>
              )
            )}

          </div>

        </Card.Body>
      </Card>

      {/* ===================================================
          FILTERS
      =================================================== */}

      <Card className="border-0 shadow-sm mb-4">
        <Card.Body>

          <Row className="g-3">

            <Col
              xs={12}
              lg={5}
            >
              <Form.Label className="small text-muted mb-1">
                Search Reference
              </Form.Label>

              <div className="input-group">

                <span className="input-group-text bg-white">
                  <i className="bi bi-search" />
                </span>

                <Form.Control
                  value={
                    search
                  }
                  placeholder="PO number, invoice number or payment reference"
                  onChange={
                    (event) =>
                      setSearch(
                        event.target.value
                      )
                  }
                />

                {search && (
                  <Button
                    variant="outline-secondary"
                    onClick={() =>
                      setSearch('')
                    }
                  >
                    <i className="bi bi-x-lg" />
                  </Button>
                )}

              </div>
            </Col>

            <Col
              xs={12}
              sm={6}
              lg={3}
            >
              <Form.Label className="small text-muted mb-1">
                Type
              </Form.Label>

              <Form.Select
                value={
                  entityType
                }
                onChange={
                  (event) =>
                    setEntityType(
                      event.target.value
                    )
                }
              >
                <option value="">
                  All Types
                </option>

                <option value="PO">
                  PO
                </option>

                <option value="INVOICE">
                  Invoice
                </option>

                <option value="PAYMENT">
                  Payment / Receipt
                </option>
              </Form.Select>
            </Col>

            <Col
              xs={12}
              sm={6}
              lg={2}
            >
              <Form.Label className="small text-muted mb-1">
                Action
              </Form.Label>

              <Form.Select
                value={
                  action
                }
                onChange={
                  (event) =>
                    setAction(
                      event.target.value
                    )
                }
              >
                <option value="">
                  All
                </option>

                <option value="CREATE">
                  Create
                </option>

                <option value="UPDATE">
                  Edit
                </option>
              </Form.Select>
            </Col>

            <Col
              xs={12}
              lg={2}
              className="d-flex align-items-end"
            >
              <Button
                variant="outline-secondary"
                className="w-100"
                onClick={() => {
                  setEntityType('');
                  setAction('');
                  setSearch('');
                }}
              >
                <i className="bi bi-funnel me-2" />

                Clear
              </Button>
            </Col>

          </Row>

        </Card.Body>
      </Card>

      {/* ===================================================
          SUMMARY
      =================================================== */}

      <Row className="g-3 mb-4">

        <Col
          xs={12}
          md={4}
        >
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="text-muted small">
                PO Requests
              </div>

              <div className="fs-3 fw-semibold">
                {counts.po}
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col
          xs={12}
          md={4}
        >
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="text-muted small">
                Invoice Requests
              </div>

              <div className="fs-3 fw-semibold">
                {counts.invoice}
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col
          xs={12}
          md={4}
        >
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="text-muted small">
                Payment Requests
              </div>

              <div className="fs-3 fw-semibold">
                {counts.payment}
              </div>
            </Card.Body>
          </Card>
        </Col>

      </Row>

      {/* ===================================================
          TABLE
      =================================================== */}

      <Card className="border-0 shadow-sm">

        <Card.Header className="bg-white border-0 pt-3 px-3">

          <div className="d-flex justify-content-between align-items-center">

            <div>
              <h6 className="mb-0">
                {humanize(
                  status
                )}{' '}
                Requests
              </h6>

              <small className="text-muted">
                {approvals.length}{' '}
                record
                {approvals.length ===
                1
                  ? ''
                  : 's'}
              </small>
            </div>

            {!canReview && (
              <Badge
                bg="secondary"
                className="px-3 py-2"
              >
                View Only
              </Badge>
            )}

          </div>

        </Card.Header>

        <Card.Body className="p-0">

          {loading ? (
            <div className="text-center py-5">

              <Spinner
                animation="border"
                size="sm"
                className="me-2"
              />

              Loading approvals...

            </div>
          ) : approvals.length ===
            0 ? (
            <div className="text-center py-5 px-3">

              <div className="display-6 text-muted mb-3">
                <i className="bi bi-inbox" />
              </div>

              <h6>
                No {status.toLowerCase()} approval requests
              </h6>

              <div className="text-muted small">
                There are no records matching the selected filters.
              </div>

            </div>
          ) : (
            <div className="table-responsive">

              <Table
                hover
                className="align-middle mb-0"
              >
                <thead className="table-light">

                  <tr>
                    <th className="ps-3">
                      Reference
                    </th>

                    <th>
                      Type
                    </th>

                    <th>
                      Action
                    </th>

                    <th>
                      Requested By
                    </th>

                    <th>
                      Requested
                    </th>

                    <th>
                      Status
                    </th>

                    <th className="text-end pe-3">
                      Action
                    </th>
                  </tr>

                </thead>

                <tbody>

                  {approvals.map(
                    (approval) => (
                      <tr
                        key={
                          approval._id
                        }
                      >
                        <td className="ps-3">

                          <div className="fw-semibold">
                            {approval.referenceNo ||
                              '-'}
                          </div>

                          <small className="text-muted">
                            {String(
                              approval._id
                            ).slice(
                              -8
                            )}
                          </small>

                        </td>

                        <td>
                          <EntityBadge
                            type={
                              approval.entityType
                            }
                          />
                        </td>

                        <td>
                          <ActionBadge
                            action={
                              approval.action
                            }
                          />
                        </td>

                        <td>
                          <div className="fw-medium">
                            {approval
                              .requestedBy
                              ?.name ||
                              '-'}
                          </div>

                          <small className="text-muted">
                            {approval
                              .requestedBy
                              ?.role ||
                              ''}
                          </small>
                        </td>

                        <td>
                          <small>
                            {formatDateTime(
                              approval.requestedAt
                            )}
                          </small>
                        </td>

                        <td>
                          <StatusBadge
                            status={
                              approval.status
                            }
                          />
                        </td>

                        <td className="text-end pe-3">

                          <div className="d-inline-flex gap-2">

                            <Button
                              size="sm"
                              variant="outline-primary"
                              onClick={() =>
                                openDetail(
                                  approval
                                )
                              }
                            >
                              <i className="bi bi-eye me-1" />

                              Review
                            </Button>

                            {canReview &&
                              approval.status ===
                                'PENDING' && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="success"
                                    onClick={() =>
                                      openApproveModal(
                                        approval
                                      )
                                    }
                                  >
                                    <i className="bi bi-check-lg" />
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant="outline-danger"
                                    onClick={() =>
                                      openRejectModal(
                                        approval
                                      )
                                    }
                                  >
                                    <i className="bi bi-x-lg" />
                                  </Button>
                                </>
                              )}

                          </div>

                        </td>

                      </tr>
                    )
                  )}

                </tbody>

              </Table>

            </div>
          )}

        </Card.Body>

      </Card>

      {/* ===================================================
          DETAIL MODAL
      =================================================== */}

      <Modal
        show={
          showDetail
        }
        onHide={() =>
          setShowDetail(
            false
          )
        }
        size="xl"
        centered
        scrollable
      >

        <Modal.Header closeButton>

          <Modal.Title className="fs-5">

            <i className="bi bi-shield-check me-2" />

            Approval Review

          </Modal.Title>

        </Modal.Header>

        <Modal.Body>

          {detailLoading ? (
            <div className="text-center py-5">

              <Spinner
                animation="border"
                className="me-2"
              />

              Loading details...

            </div>
          ) : selectedApproval ? (
            <>

              {/* =============================================
                  REQUEST HEADER
              ============================================= */}

              <Card className="border-0 bg-light mb-4">

                <Card.Body>

                  <Row className="g-3">

                    <Col
                      xs={12}
                      md={3}
                    >
                      <small className="text-muted d-block">
                        Reference
                      </small>

                      <strong>
                        {selectedApproval.referenceNo ||
                          '-'}
                      </strong>
                    </Col>

                    <Col
                      xs={6}
                      md={2}
                    >
                      <small className="text-muted d-block">
                        Type
                      </small>

                      <EntityBadge
                        type={
                          selectedApproval.entityType
                        }
                      />
                    </Col>

                    <Col
                      xs={6}
                      md={2}
                    >
                      <small className="text-muted d-block">
                        Action
                      </small>

                      <ActionBadge
                        action={
                          selectedApproval.action
                        }
                      />
                    </Col>

                    <Col
                      xs={6}
                      md={2}
                    >
                      <small className="text-muted d-block">
                        Status
                      </small>

                      <StatusBadge
                        status={
                          selectedApproval.status
                        }
                      />
                    </Col>

                    <Col
                      xs={6}
                      md={3}
                    >
                      <small className="text-muted d-block">
                        Requested At
                      </small>

                      <strong className="small">
                        {formatDateTime(
                          selectedApproval.requestedAt
                        )}
                      </strong>
                    </Col>

                  </Row>

                  <hr />

                  <Row className="g-3">

                    <Col
                      xs={12}
                      md={4}
                    >
                      <small className="text-muted d-block">
                        Requested By
                      </small>

                      <strong>
                        {selectedApproval
                          .requestedBy
                          ?.name ||
                          '-'}
                      </strong>

                      <div className="small text-muted">
                        {selectedApproval
                          .requestedBy
                          ?.email ||
                          ''}
                      </div>
                    </Col>

                    <Col
                      xs={12}
                      md={4}
                    >
                      <small className="text-muted d-block">
                        Request Reason
                      </small>

                      <span>
                        {selectedApproval.reason ||
                          'No reason provided'}
                      </span>
                    </Col>

                    <Col
                      xs={12}
                      md={4}
                    >
                      <small className="text-muted d-block">
                        Reviewed By
                      </small>

                      {selectedApproval.reviewedBy ? (
                        <>
                          <strong>
                            {selectedApproval
                              .reviewedBy
                              ?.name ||
                              '-'}
                          </strong>

                          <div className="small text-muted">
                            {formatDateTime(
                              selectedApproval.reviewedAt
                            )}
                          </div>
                        </>
                      ) : (
                        <span className="text-muted">
                          Not reviewed
                        </span>
                      )}
                    </Col>

                  </Row>

                  {selectedApproval.reviewRemarks && (
                    <>
                      <hr />

                      <small className="text-muted d-block">
                        Review Remarks
                      </small>

                      <div>
                        {selectedApproval.reviewRemarks}
                      </div>
                    </>
                  )}

                </Card.Body>

              </Card>

              {/* =============================================
                  COMPARISON
              ============================================= */}

              <div className="d-flex justify-content-between align-items-center mb-2">

                <div>
                  <h6 className="mb-0">
                    {isCreateRequest
                      ? 'Submitted Data'
                      : 'Change Comparison'}
                  </h6>

                  <small className="text-muted">
                    {isCreateRequest
                      ? 'Review the values before approving this new record.'
                      : 'Changed fields are highlighted.'}
                  </small>
                </div>

                {!isCreateRequest && (
                  <Badge
                    bg="warning"
                    text="dark"
                  >
                    {
                      comparisonFields.filter(
                        (item) =>
                          item.changed
                      ).length
                    }{' '}
                    Changed
                  </Badge>
                )}

              </div>

              <div className="table-responsive border rounded">

                <Table
                  className="mb-0 align-middle"
                >

                  <thead className="table-light">

                    <tr>
                      <th
                        style={{
                          width: '20%'
                        }}
                      >
                        Field
                      </th>

                      {!isCreateRequest && (
                        <th
                          style={{
                            width: '40%'
                          }}
                        >
                          Current / Old
                        </th>
                      )}

                      <th>
                        {isCreateRequest
                          ? 'Submitted Value'
                          : 'Proposed / New'}
                      </th>
                    </tr>

                  </thead>

                  <tbody>

                    {comparisonFields.length ===
                    0 ? (
                      <tr>
                        <td
                          colSpan={
                            isCreateRequest
                              ? 2
                              : 3
                          }
                          className="text-center text-muted py-4"
                        >
                          No comparison data available.
                        </td>
                      </tr>
                    ) : (
                      comparisonFields.map(
                        ({
                          key,
                          oldValue,
                          newValue,
                          changed
                        }) => (
                          <tr
                            key={
                              key
                            }
                            className={
                              changed
                                ? 'table-warning'
                                : ''
                            }
                          >
                            <td>
                              <div className="fw-semibold">
                                {humanize(
                                  key
                                )}
                              </div>

                              {changed &&
                                !isCreateRequest && (
                                  <small className="text-warning-emphasis">
                                    Changed
                                  </small>
                                )}
                            </td>

                            {!isCreateRequest && (
                              <td>
                                <DisplayValue
                                  field={
                                    key
                                  }
                                  value={
                                    oldValue
                                  }
                                />
                              </td>
                            )}

                            <td>
                              <DisplayValue
                                field={
                                  key
                                }
                                value={
                                  newValue
                                }
                              />
                            </td>
                          </tr>
                        )
                      )
                    )}

                  </tbody>

                </Table>

              </div>

            </>
          ) : null}

        </Modal.Body>

        <Modal.Footer>

          <Button
            variant="light"
            onClick={() =>
              setShowDetail(
                false
              )
            }
          >
            Close
          </Button>

          {canReview &&
            selectedApproval?.status ===
              'PENDING' && (
              <>
                <Button
                  variant="outline-danger"
                  onClick={() => {
                    setShowDetail(
                      false
                    );

                    openRejectModal(
                      selectedApproval
                    );
                  }}
                >
                  <i className="bi bi-x-circle me-2" />

                  Reject
                </Button>

                <Button
                  variant="success"
                  onClick={() => {
                    setShowDetail(
                      false
                    );

                    openApproveModal(
                      selectedApproval
                    );
                  }}
                >
                  <i className="bi bi-check-circle me-2" />

                  Approve
                </Button>
              </>
            )}

        </Modal.Footer>

      </Modal>

      {/* ===================================================
          APPROVE MODAL
      =================================================== */}

      <Modal
        show={
          showApprove
        }
        onHide={() => {
          if (
            !processing
          ) {
            setShowApprove(
              false
            );
          }
        }}
        centered
      >

        <Modal.Header closeButton={!processing}>

          <Modal.Title className="fs-5">

            <i className="bi bi-check-circle-fill text-success me-2" />

            Approve Request

          </Modal.Title>

        </Modal.Header>

        <Modal.Body>

          <Alert
            variant="success"
            className="small"
          >
            You are approving{' '}
            <strong>
              {selectedApproval?.entityType}
            </strong>{' '}
            {selectedApproval?.action?.toLowerCase()}{' '}
            for{' '}
            <strong>
              {selectedApproval?.referenceNo ||
                '-'}
            </strong>.
          </Alert>

          <Form.Group>

            <Form.Label>
              Approval Remarks
              <span className="text-muted fw-normal">
                {' '}(optional)
              </span>
            </Form.Label>

            <Form.Control
              as="textarea"
              rows={4}
              value={
                approveRemarks
              }
              disabled={
                processing
              }
              placeholder="Example: Verified with Tally invoice and approved."
              onChange={
                (event) =>
                  setApproveRemarks(
                    event.target.value
                  )
              }
            />

          </Form.Group>

          <div className="small text-muted mt-3">

            <i className="bi bi-info-circle me-1" />

            Approval will apply the transaction or proposed changes and update reconciliation where applicable.

          </div>

        </Modal.Body>

        <Modal.Footer>

          <Button
            variant="light"
            disabled={
              processing
            }
            onClick={() =>
              setShowApprove(
                false
              )
            }
          >
            Cancel
          </Button>

          <Button
            variant="success"
            disabled={
              processing
            }
            onClick={
              approveRequest
            }
          >
            {processing ? (
              <>
                <Spinner
                  animation="border"
                  size="sm"
                  className="me-2"
                />

                Approving...
              </>
            ) : (
              <>
                <i className="bi bi-check-lg me-2" />

                Approve
              </>
            )}
          </Button>

        </Modal.Footer>

      </Modal>

      {/* ===================================================
          REJECT MODAL
      =================================================== */}

      <Modal
        show={
          showReject
        }
        onHide={() => {
          if (
            !processing
          ) {
            setShowReject(
              false
            );
          }
        }}
        centered
      >

        <Modal.Header closeButton={!processing}>

          <Modal.Title className="fs-5">

            <i className="bi bi-x-circle-fill text-danger me-2" />

            Reject Request

          </Modal.Title>

        </Modal.Header>

        <Modal.Body>

          <Alert
            variant="danger"
            className="small"
          >
            You are rejecting{' '}
            <strong>
              {selectedApproval?.entityType}
            </strong>{' '}
            {selectedApproval?.action?.toLowerCase()}{' '}
            for{' '}
            <strong>
              {selectedApproval?.referenceNo ||
                '-'}
            </strong>.
          </Alert>

          <Form.Group>

            <Form.Label>
              Rejection Remarks
              <span className="text-danger">
                {' '}*
              </span>
            </Form.Label>

            <Form.Control
              as="textarea"
              rows={4}
              autoFocus
              value={
                rejectRemarks
              }
              disabled={
                processing
              }
              placeholder="Enter why this request is being rejected."
              onChange={
                (event) =>
                  setRejectRemarks(
                    event.target.value
                  )
              }
            />

            <Form.Text className="text-muted">
              Rejection remarks are mandatory.
            </Form.Text>

          </Form.Group>

        </Modal.Body>

        <Modal.Footer>

          <Button
            variant="light"
            disabled={
              processing
            }
            onClick={() =>
              setShowReject(
                false
              )
            }
          >
            Cancel
          </Button>

          <Button
            variant="danger"
            disabled={
              processing ||
              !rejectRemarks.trim()
            }
            onClick={
              rejectRequest
            }
          >
            {processing ? (
              <>
                <Spinner
                  animation="border"
                  size="sm"
                  className="me-2"
                />

                Rejecting...
              </>
            ) : (
              <>
                <i className="bi bi-x-lg me-2" />

                Reject Request
              </>
            )}
          </Button>

        </Modal.Footer>

      </Modal>

    </div>
  );
}