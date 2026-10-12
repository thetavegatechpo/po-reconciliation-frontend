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
  Modal,
  Row,
  Spinner,
  Table
} from 'react-bootstrap';

import api, {
  fileUrl
} from '../api/client';

import {
  date,
  money
} from '../utils/format';

import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import './InvoicesPage.layout.css';
import './InvoicesPage.extra.css';

import {
  useAuth
} from '../context/AuthContext';
import {useLocation,useNavigate} from 'react-router-dom';


/* =========================================================
   CONSTANTS
========================================================= */

const MAX_FILE_SIZE =
  10 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.htm',
  '.html',
  '.txt'
]);


/* =========================================================
   EMPTY FORM
========================================================= */

function getEmptyForm() {
  return {
    po: '',
    poAllocations: [], // Single-element array retained for backend compatibility.

    invoiceNumber: '',

    invoiceDate:
      new Date()
        .toISOString()
        .slice(0, 10),

    invoiceAmount: '',

    gstTaxPercent: 18,

    gstTaxAmount: '',

    roundOffAmount: 0,

    totalInvoiceAmount: '',

    invoiceDueDate: '',
    paymentTermDays: '',

    invoiceClosureStatus: 'OPEN',
    eWayBillNumber: '',
    materialDelivered: 'NO',
    actualDeliveryDate: '',
    remarks: ''
  };
}


/* =========================================================
   HELPERS
========================================================= */

function num(value) {
  const n =
    Number(value || 0);

  return Number.isFinite(n)
    ? n
    : 0;
}


function getId(value) {
  if (!value) {
    return '';
  }

  if (
    typeof value ===
    'string'
  ) {
    return value;
  }

  return (
    value._id ||
    value.id ||
    ''
  );
}


function getExtension(
  fileName
) {
  const name =
    String(
      fileName || ''
    ).toLowerCase();

  const index =
    name.lastIndexOf('.');

  if (index === -1) {
    return '';
  }

  return name.slice(
    index
  );
}


function toInputDate(value) {
  if (!value) {
    return '';
  }

  const d =
    new Date(value);

  if (
    Number.isNaN(
      d.getTime()
    )
  ) {
    return '';
  }

  return d
    .toISOString()
    .slice(0, 10);
}


// Calculate invoice due date from invoice date + payment terms (calendar days).
function calculateDueDate(invoiceDate, paymentTermDays) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(invoiceDate || ''))) return '';
  if (paymentTermDays === '' || paymentTermDays === null || paymentTermDays === undefined) return '';
  const days = Number(paymentTermDays);
  if (!Number.isSafeInteger(days) || days < 0 || days > 3650) return '';
  const [year, month, day] = invoiceDate.split('-').map(Number);
  const result = new Date(Date.UTC(year, month - 1, day));
  if (result.getUTCFullYear() !== year || result.getUTCMonth() !== month - 1 || result.getUTCDate() !== day) return '';
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

// Preserve the due date on older invoices that did not store payment terms.
function existingPaymentTermDays(invoice) {
  const dateValue = toInputDate(invoice?.invoiceDate);
  const dueValue = toInputDate(invoice?.invoiceDueDate);
  if (dateValue && dueValue) {
    const days = Math.round((Date.parse(dueValue) - Date.parse(dateValue)) / 86400000);
    if (days >= 0 && days <= 3650) return String(days);
  }
  if (invoice?.paymentTermDays != null && Number(invoice.paymentTermDays) >= 0) {
    return String(invoice.paymentTermDays);
  }
  return '';
}

/* =========================================================
   APPROVAL HELPERS

   Legacy invoices without approvalStatus are treated as
   APPROVED because old records existed before approval flow.
========================================================= */

function invoiceApprovalStatus(
  invoice
) {
  return (
    invoice?.approvalStatus ||
    'APPROVED'
  );
}


function isInvoiceApproved(
  invoice
) {
  return (
    invoiceApprovalStatus(
      invoice
    ) === 'APPROVED'
  );
}


function hasPendingEdit(
  invoice
) {
  return (
    invoice?.editApprovalStatus ===
    'PENDING'
  );
}


function ApprovalBadge({
  invoice
}) {
  const approvalStatus =
    invoiceApprovalStatus(
      invoice
    );

  const editStatus =
    invoice?.editApprovalStatus ||
    'NONE';

  const revision =
    num(
      invoice?.revisionNo
    );

  return (
    <div className="d-flex flex-wrap gap-1 mt-1">

      {approvalStatus ===
        'PENDING' && (
        <Badge
          bg="warning"
          text="dark"
          className="fw-normal"
        >
          <i className="bi bi-clock-history me-1" />

          Pending Approval
        </Badge>
      )}

      {approvalStatus ===
        'APPROVED' && (
        <Badge
          bg="success"
          className="fw-normal"
        >
          <i className="bi bi-check-circle me-1" />

          Approved
        </Badge>
      )}

      {approvalStatus ===
        'REJECTED' && (
        <Badge
          bg="danger"
          className="fw-normal"
        >
          <i className="bi bi-x-circle me-1" />

          Rejected
        </Badge>
      )}

      {approvalStatus ===
        'APPROVED' &&
        editStatus ===
          'PENDING' && (
          <Badge
            bg="warning"
            text="dark"
            className="fw-normal"
          >
            <i className="bi bi-pencil-square me-1" />

            Edit Pending
          </Badge>
        )}

      {approvalStatus ===
        'APPROVED' &&
        editStatus ===
          'REJECTED' && (
          <Badge
            bg="danger"
            className="fw-normal"
          >
            Edit Rejected
          </Badge>
        )}

      {approvalStatus ===
        'APPROVED' &&
        editStatus !==
          'PENDING' &&
        editStatus !==
          'REJECTED' &&
        (
          invoice?.isEdited ||
          revision > 0
        ) && (
          <Badge
            bg="info"
            text="dark"
            className="fw-normal"
          >
            Edited • Rev {revision}
          </Badge>
        )}

      {approvalStatus ===
        'APPROVED' &&
        editStatus ===
          'PENDING' &&
        revision > 0 && (
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


/* =========================================================
   COMPONENT
========================================================= */

export default function InvoicesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const draftPrefill = location.state?.draftPrefill || null;
  const [activeDraftId,setActiveDraftId] = useState(null);
  const {
    can
  } = useAuth();

  const [
    data,
    setData
  ] = useState([]);

  const [
    pos,
    setPos
  ] = useState([]);

  const [
    show,
    setShow
  ] = useState(false);

  const [
    form,
    setForm
  ] = useState(
    getEmptyForm()
  );

  const [
    file,
    setFile
  ] = useState(null);

  const [
    err,
    setErr
  ] = useState('');

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    saving,
    setSaving
  ] = useState(false);

  const [
    editingInvoice,
    setEditingInvoice
  ] = useState(null);

  const [
    filters,
    setFilters
  ] = useState({
    search: '',
    paymentStatus: '',
    approvalStatus: '',
    editApprovalStatus: '',
    fromDate: '',
    toDate: '',
    dueFrom: '',
    dueTo: ''
  });


  const isEditing =
    Boolean(
      editingInvoice?._id
    );


  const canManage =
    can('invoice.create');


  /* =========================================================
     LOAD
  ========================================================= */

  async function load() {
    try {
      setLoading(true);
      setErr('');

      const [
        invoiceResponse,
        poResponse
      ] =
        await Promise.all([
          api.get(
            '/invoices',
            {
              params:
                filters
            }
          ),

          api.get(
            '/pos',
            {
              params: {
                limit: 200
              }
            }
          )
        ]);

      setData(
        invoiceResponse
          .data
          .data ||
        []
      );

      setPos(
        poResponse
          .data
          .data ||
        []
      );
    } catch (error) {
      setErr(
        error.response
          ?.data
          ?.message ||
        'Unable to load invoices.'
      );
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    load();
  }, [
    filters.search,
    filters.paymentStatus,
    filters.approvalStatus,
    filters.editApprovalStatus,
    filters.fromDate,
    filters.toDate,
    filters.dueFrom,
    filters.dueTo
  ]);


  // Prefill the EXISTING Tally invoice form only once PO choices are loaded.
  useEffect(() => {
    if (!draftPrefill || !pos.length || activeDraftId === draftPrefill.draftId) return;
    if (!pos.some(p => String(p._id) === String(draftPrefill.poId))) return;
    const invoiceDate = new Date().toLocaleDateString('en-CA');
    setEditingInvoice(null);
    setForm({...getEmptyForm(), po:draftPrefill.poId,
      invoiceDate, invoiceAmount:String(draftPrefill.invoiceAmount),
      gstTaxPercent:draftPrefill.gstTaxPercent,roundOffAmount:draftPrefill.roundOffAmount,
      paymentTermDays:String(draftPrefill.paymentTermDays),
      invoiceDueDate:calculateDueDate(invoiceDate,draftPrefill.paymentTermDays),
      remarks:draftPrefill.remarks || ''});
    setActiveDraftId(draftPrefill.draftId);
    setShow(true);
    navigate('/invoices',{replace:true,state:null});
  },[draftPrefill,pos,activeDraftId,navigate]);

  /* =========================================================
     GST / FINAL TOTAL
  ========================================================= */

  useEffect(() => {
    const basic =
      num(
        form.invoiceAmount
      );

    const gstPercent =
      num(
        form.gstTaxPercent
      );

    const roundOff =
      num(
        form.roundOffAmount
      );

    const gstAmount =
      basic *
      gstPercent /
      100;

    const total =
      basic +
      gstAmount +
      roundOff;

    const newGST =
      basic > 0
        ? gstAmount.toFixed(2)
        : '';

    const newTotal =
      basic > 0
        ? total.toFixed(2)
        : '';

    setForm(
      (prev) => {
        if (
          prev.gstTaxAmount ===
            newGST &&
          prev.totalInvoiceAmount ===
            newTotal
        ) {
          return prev;
        }

        return {
          ...prev,

          gstTaxAmount:
            newGST,

          totalInvoiceAmount:
            newTotal
        };
      }
    );
  }, [
    form.invoiceAmount,
    form.gstTaxPercent,
    form.roundOffAmount
  ]);


  /* =========================================================
     PO HELPERS
  ========================================================= */

  function customerName(po) {
    return (
      po?.customerSnapshot
        ?.name ||
      po?.customer?.name ||
      '—'
    );
  }


  function customerCode(po) {
    return (
      po?.customerSnapshot
        ?.code ||
      po?.customer?.code ||
      ''
    );
  }


  function vendorCode(po) {
    return (
      po?.customerSnapshot
        ?.vendorCode ||
      po?.customer
        ?.vendorCode ||
      ''
    );
  }


  function customerGSTIN(po) {
    return (
      po?.customerSnapshot
        ?.gstin ||
      po?.customer?.gstin ||
      ''
    );
  }


  /* =========================================================
     SELECTED PO
  ========================================================= */

  const selectedPO =
    useMemo(() => {
      return pos.find(
        (po) =>
          String(
            po._id
          ) ===
          String(
            form.po
          )
      );
    }, [
      pos,
      form.po
    ]);


  /* =========================================================
     AVAILABLE PO
  ========================================================= */

  // Only one PO can be selected for a new invoice.
  const availablePOs = useMemo(() => pos.filter(po => {
    const original = isEditing && getId(editingInvoice?.po) === String(po._id);
    const available = num(po.financialSummary?.uninvoicedAmount) > 0;
    return original || (
      po.executionStatus !== 'CANCELLED' &&
      po.overallStatus !== 'CANCELLED' &&
      available
    );
  }), [pos, isEditing, editingInvoice]);

  function updatePOSelection(poId) {
    setForm(prev => ({ ...prev, po: poId }));
  }

  /* =========================================================
     INVOICE MADE

     This uses approved/reconciled PO financial values.

     A newly registered PENDING invoice must NOT make the
     PO financially invoiced until approval.
  ========================================================= */

  const selectedPOInvoiceMade =
    useMemo(() => {
      if (!selectedPO) {
        return false;
      }

      return (
        selectedPO.invoiceStatus !==
          'NOT_INVOICED' ||
        num(
          selectedPO
            .financialSummary
            ?.totalInvoiced
        ) > 0
      );
    }, [
      selectedPO
    ]);


  /* =========================================================
     AVAILABLE VALUE FOR CURRENT INVOICE

     CREATE:
     PO uninvoiced amount.

     EDIT:
     approved current invoice is already included in
     PO totalInvoiced, so add current invoice total back.
  ========================================================= */

  const availableForInvoice =
    useMemo(() => {
      if (!selectedPO) {
        return 0;
      }

      const uninvoiced =
        num(
          selectedPO
            .financialSummary
            ?.uninvoicedAmount
        );

      if (
        !isEditing ||
        !editingInvoice
      ) {
        return uninvoiced;
      }

      const samePO =
        String(
          getId(
            editingInvoice.po
          )
        ) ===
        String(
          selectedPO._id
        );

      if (!samePO) {
        return uninvoiced;
      }

      return (
        uninvoiced +
        num(
          editingInvoice
            .totalInvoiceAmount
        )
      );
    }, [
      selectedPO,
      isEditing,
      editingInvoice
    ]);


  /* =========================================================
     FILE CHANGE
  ========================================================= */

  function handleFileChange(
    event
  ) {
    setErr('');

    const selected =
      event.target
        .files?.[0];

    if (!selected) {
      setFile(null);
      return;
    }

    const extension =
      getExtension(
        selected.name
      );

    if (
      !ALLOWED_EXTENSIONS.has(
        extension
      )
    ) {
      event.target.value =
        '';

      setFile(null);

      setErr(
        'Invalid invoice document. Allowed formats: PDF, DOC, DOCX, XLS, XLSX, JPG, JPEG, PNG, WEBP, HTM, HTML and TXT.'
      );

      return;
    }

    if (
      selected.size >
      MAX_FILE_SIZE
    ) {
      event.target.value =
        '';

      setFile(null);

      setErr(
        'Invoice document cannot exceed 10 MB.'
      );

      return;
    }

    setFile(
      selected
    );
  }


  /* =========================================================
     OPEN CREATE
  ========================================================= */

  function openModal() {
    setActiveDraftId(null);
    setEditingInvoice(
      null
    );

    setForm(
      getEmptyForm()
    );

    setFile(null);
    setErr('');
    setShow(true);
  }


  /* =========================================================
     OPEN EDIT

     Only APPROVED invoice can be edited.

     Initial PENDING / REJECTED invoices cannot be edited.

     Approved invoice with pending amendment cannot receive
     another edit request.
  ========================================================= */

  function openEditModal(
    invoice
  ) {
    setErr('');

    const approvalStatus =
      invoiceApprovalStatus(
        invoice
      );

    if (
      approvalStatus ===
      'PENDING'
    ) {
      setErr(
        'This invoice is waiting for approval. It cannot be edited until the approval is completed.'
      );

      return;
    }

    if (
      approvalStatus ===
      'REJECTED'
    ) {
      setErr(
        'This invoice was rejected and cannot be edited.'
      );

      return;
    }

    if (
      hasPendingEdit(
        invoice
      )
    ) {
      setErr(
        'An edit request for this invoice is already pending approval.'
      );

      return;
    }

    // Avoid silently dropping allocations from older multi-PO invoices.
    if (invoice.poAllocations?.length > 1) {
      setErr('This existing invoice covers multiple POs and cannot be edited in single-PO mode.');
      return;
    }

    setFile(null);

    const basic =
      num(
        invoice.invoiceAmount
      );

    const gstAmount =
      num(
        invoice.gstTaxAmount
      );

    let gstPercent =
      invoice.gstTaxPercent;

    if (
      gstPercent ===
        undefined ||
      gstPercent ===
        null ||
      gstPercent ===
        ''
    ) {
      gstPercent =
        basic > 0
          ? Number(
              (
                gstAmount /
                basic *
                100
              ).toFixed(2)
            )
          : 0;
    }

    setEditingInvoice(
      invoice
    );

    setForm({
      po: getId(invoice.po),
      poAllocations: [],

      invoiceNumber:
        invoice.invoiceNumber ||
        '',

      invoiceDate:
        toInputDate(
          invoice.invoiceDate
        ),

      invoiceAmount:
        basic > 0
          ? basic.toFixed(2)
          : '',

      gstTaxPercent:
        gstPercent,

      gstTaxAmount:
        gstAmount.toFixed(2),

      roundOffAmount:
        num(
          invoice.roundOffAmount
        ),

      totalInvoiceAmount:
        num(
          invoice.totalInvoiceAmount
        ).toFixed(2),

      invoiceDueDate:
        toInputDate(
          invoice.invoiceDueDate
        ),
      paymentTermDays: existingPaymentTermDays(invoice),

      invoiceClosureStatus: invoice.invoiceClosureStatus || 'OPEN',
      eWayBillNumber: invoice.eWayBillNumber || '',
      materialDelivered: invoice.materialDelivered || 'NO',
      actualDeliveryDate: toInputDate(invoice.actualDeliveryDate),
      remarks:
        invoice.remarks ||
        ''
    });

    setShow(true);
  }


  /* =========================================================
     CLOSE
  ========================================================= */

  function closeModal() {
    if (saving) {
      return;
    }

    setShow(false);

    setEditingInvoice(
      null
    );

    setForm(
      getEmptyForm()
    );

    setFile(null);
    setErr('');
  }


  /* =========================================================
     SAVE CREATE / UPDATE

     CREATE:
     Backend saves invoice as PENDING and creates
     ApprovalRequest.

     UPDATE:
     Backend keeps current approved invoice unchanged and
     creates UPDATE ApprovalRequest.

     Therefore frontend never manually changes approval state.
  ========================================================= */

  async function save(
    event
  ) {
    event.preventDefault();

    try {
      setSaving(true);
      setErr('');

      /* -----------------------------------------------------
         EXTRA APPROVAL GUARD
      ----------------------------------------------------- */

      if (
        isEditing &&
        invoiceApprovalStatus(
          editingInvoice
        ) !== 'APPROVED'
      ) {
        setErr(
          'Only an approved invoice can be edited.'
        );

        return;
      }

      if (
        isEditing &&
        hasPendingEdit(
          editingInvoice
        )
      ) {
        setErr(
          'An edit request for this invoice is already pending approval.'
        );

        return;
      }

      /* -----------------------------------------------------
         PO
      ----------------------------------------------------- */

      if (!selectedPO) {
        setErr(
          'Please select a Customer PO.'
        );

        return;
      }

      /* -----------------------------------------------------
         DOCUMENT
      ----------------------------------------------------- */

      if (
        !isEditing &&
        !file
      ) {
        setErr(
          'Invoice document is required. Upload the invoice generated from Tally.'
        );

        return;
      }

      if (!calculateDueDate(form.invoiceDate, form.paymentTermDays)) {
        setErr('Enter a valid invoice date and payment terms (0 to 3650 days).');
        return;
      }
      if (form.invoiceDueDate !== calculateDueDate(form.invoiceDate, form.paymentTermDays)) {
        setErr('The due date must match invoice date plus payment term days.');
        return;
      }

      /* -----------------------------------------------------
         DATES
      ----------------------------------------------------- */

      if (
        form.invoiceDate &&
        form.invoiceDueDate &&
        new Date(
          form.invoiceDueDate
        ) <
          new Date(
            form.invoiceDate
          )
      ) {
        setErr(
          'Invoice due date cannot be before invoice date.'
        );

        return;
      }

      /* -----------------------------------------------------
         VALUES
      ----------------------------------------------------- */

      const invoiceAmount =
        num(
          form.invoiceAmount
        );

      const gstTaxPercent =
        num(
          form.gstTaxPercent
        );

      const roundOffAmount =
        num(
          form.roundOffAmount
        );

      const gstTaxAmount =
        Number(
          (
            invoiceAmount *
            gstTaxPercent /
            100
          ).toFixed(2)
        );

      const totalInvoiceAmount =
        Number(
          (
            invoiceAmount +
            gstTaxAmount +
            roundOffAmount
          ).toFixed(2)
        );

      if (
        invoiceAmount <= 0
      ) {
        setErr(
          'Taxable / Basic amount must be greater than zero.'
        );

        return;
      }

      if (
        gstTaxPercent < 0 ||
        gstTaxPercent > 100
      ) {
        setErr(
          'GST / Tax percentage must be between 0 and 100.'
        );

        return;
      }

      if (
        totalInvoiceAmount <= 0
      ) {
        setErr(
          'Final invoice amount must be greater than zero.'
        );

        return;
      }

      /* -----------------------------------------------------
         ALREADY SETTLED PROTECTION
      ----------------------------------------------------- */

      if (
        isEditing &&
        totalInvoiceAmount +
          0.01 <
          num(
            editingInvoice
              ?.paidAmount
          )
      ) {
        setErr(
          `Final invoice amount cannot be less than the already settled amount of ${money(
            editingInvoice
              ?.paidAmount
          )}.`
        );

        return;
      }

      if (totalInvoiceAmount > availableForInvoice + 0.01) {
        setErr(`Final invoice total ${money(totalInvoiceAmount)} exceeds the available PO balance ${money(availableForInvoice)}.`);
        return;
      }

      /* Single-PO invoice payload */
      const fd =
        new FormData();

      fd.append(
        'data',
        JSON.stringify({
          po: form.po,
          // Keep exactly one allocation until the backend is also simplified.
          poAllocations: [{ po: form.po, allocatedAmount: totalInvoiceAmount }],

          invoiceNumber:
            String(
              form.invoiceNumber ||
                ''
            )
              .trim()
              .toUpperCase(),

          invoiceDate:
            form.invoiceDate,

          invoiceAmount,

          gstTaxPercent,

          gstTaxAmount,

          roundOffAmount,

          totalInvoiceAmount,

          invoiceDueDate:
            form.invoiceDueDate,

          invoiceClosureStatus: form.invoiceClosureStatus,
          eWayBillNumber: form.eWayBillNumber,
          materialDelivered: form.materialDelivered,
          actualDeliveryDate: form.materialDelivered === 'YES' ? form.actualDeliveryDate : null,
          dueDateBasis: 'INVOICE_DATE',
          paymentTermDays: Number(form.paymentTermDays),
          remarks:
            String(
              form.remarks ||
                ''
            ).trim(),

          allocations:
            editingInvoice
              ?.allocations ||
            []
        })
      );

      if (file) {
        fd.append(
          'invoiceDocument',
          file
        );
      }

      /* -----------------------------------------------------
         CREATE / UPDATE
      ----------------------------------------------------- */

      if (isEditing) {
        await api.put(
          `/invoices/${editingInvoice._id}`,
          fd
        );
      } else {
        const createdResponse = await api.post(
          '/invoices',
          fd
        );
        if (activeDraftId) {
          try {
            await api.post(`/invoice-drafts/${activeDraftId}/convert`, {
              invoiceId: createdResponse.data?.data?._id
            });
          } catch (linkError) {
            setActiveDraftId(null);
            setShow(false);
            await load();
            setErr('Tally invoice was registered, but its draft link could not be saved. Do not submit the invoice again. Ask an administrator to reconcile the draft link.');
            return;
          }
        }
      }

      setActiveDraftId(null);
      setShow(false);

      setEditingInvoice(
        null
      );

      setForm(
        getEmptyForm()
      );

      setFile(null);

      await load();

    } catch (error) {
      const response =
        error.response?.data;

      if (
        Array.isArray(
          response?.errors
        ) &&
        response.errors.length
      ) {
        setErr(
          response.errors
            .map(
              (item) =>
                item.message
            )
            .join(' ')
        );
      } else {
        setErr(
          response?.message ||
          (
            isEditing
              ? 'Unable to submit invoice edit for approval.'
              : 'Unable to submit invoice for approval.'
          )
        );
      }
    } finally {
      setSaving(false);
    }
  }


  /* =========================================================
     APPROVAL COUNTS
  ========================================================= */

  const approvalCounts =
    useMemo(() => {
      return data.reduce(
        (
          result,
          invoice
        ) => {
          const status =
            invoiceApprovalStatus(
              invoice
            );

          if (
            status ===
            'APPROVED'
          ) {
            result.approved += 1;
          } else if (
            status ===
            'PENDING'
          ) {
            result.pending += 1;
          } else if (
            status ===
            'REJECTED'
          ) {
            result.rejected += 1;
          }

          if (
            invoice
              ?.editApprovalStatus ===
            'PENDING'
          ) {
            result.editPending +=
              1;
          }

          return result;
        },
        {
          approved: 0,
          pending: 0,
          rejected: 0,
          editPending: 0
        }
      );
    }, [
      data
    ]);


  /* =========================================================
     UI
  ========================================================= */

  return (
    <>

      <PageHeader
        title="Sales Invoices"
        subtitle="Register invoices generated in Tally against Customer POs and track payment reconciliation."
        actions={
          canManage ? (
            <Button
              className="primary-btn"
              onClick={
                openModal
              }
            >
              <i className="bi bi-plus-lg me-1" />

              Add Tally Invoice
            </Button>
          ) : null
        }
      />


      {/* =====================================================
          APPROVAL SUMMARY
      ===================================================== */}

      <Row className="g-2 mb-3 tv-kpi-row">

        <Col
          xs={6}
          md={3}
        >
          <Card className="h-100 border-0 shadow-sm">
            <Card.Body className="py-3">
              <small className="text-muted d-block">
                Approved
              </small>

              <strong className="fs-5 text-success">
                {approvalCounts.approved}
              </strong>
            </Card.Body>
          </Card>
        </Col>

        <Col
          xs={6}
          md={3}
        >
          <Card className="h-100 border-0 shadow-sm">
            <Card.Body className="py-3">
              <small className="text-muted d-block">
                Pending Approval
              </small>

              <strong className="fs-5">
                {approvalCounts.pending}
              </strong>
            </Card.Body>
          </Card>
        </Col>

        <Col
          xs={6}
          md={3}
        >
          <Card className="h-100 border-0 shadow-sm">
            <Card.Body className="py-3">
              <small className="text-muted d-block">
                Edit Pending
              </small>

              <strong className="fs-5">
                {approvalCounts.editPending}
              </strong>
            </Card.Body>
          </Card>
        </Col>

        <Col
          xs={6}
          md={3}
        >
          <Card className="h-100 border-0 shadow-sm">
            <Card.Body className="py-3">
              <small className="text-muted d-block">
                Rejected
              </small>

              <strong className="fs-5 text-danger">
                {approvalCounts.rejected}
              </strong>
            </Card.Body>
          </Card>
        </Col>

      </Row>


      {/* =====================================================
          ERROR
      ===================================================== */}

      {err && !show && (
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
          FILTERS
      ===================================================== */}

      <Card className="filter-card mb-3">

        <Card.Body>

          <Row className="g-2">

            <Col
              md={6}
              lg={3}
            >
              <Form.Control
                placeholder="Search invoice number..."
                value={
                  filters.search
                }
                onChange={(e) =>
                  setFilters(
                    (prev) => ({
                      ...prev,

                      search:
                        e.target.value
                    })
                  )
                }
              />
            </Col>


            <Col
              md={6}
              lg={3}
            >
              <Form.Select
                value={
                  filters.paymentStatus
                }
                onChange={(e) =>
                  setFilters(
                    (prev) => ({
                      ...prev,

                      paymentStatus:
                        e.target.value
                    })
                  )
                }
              >
                <option value="">
                  All Payment Status
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


            {/* APPROVAL STATUS */}

            <Col
              md={6}
              lg={3}
            >
              <Form.Select
                value={
                  filters.approvalStatus
                }
                onChange={(e) =>
                  setFilters(
                    (prev) => ({
                      ...prev,

                      approvalStatus:
                        e.target.value
                    })
                  )
                }
              >
                <option value="">
                  All Approval Status
                </option>

                <option value="PENDING">
                  Pending Approval
                </option>

                <option value="APPROVED">
                  Approved
                </option>

                <option value="REJECTED">
                  Rejected
                </option>
              </Form.Select>
            </Col>


            {/* EDIT APPROVAL STATUS */}

            <Col
              md={6}
              lg={3}
            >
              <Form.Select
                value={
                  filters.editApprovalStatus
                }
                onChange={(e) =>
                  setFilters(
                    (prev) => ({
                      ...prev,

                      editApprovalStatus:
                        e.target.value
                    })
                  )
                }
              >
                <option value="">
                  All Invoice Edits
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


            <Col
              md={6}
              lg={3}
            >
              <Form.Label className="small text-muted mb-1">
                Invoice Date From
              </Form.Label>

              <Form.Control
                type="date"
                value={
                  filters.fromDate
                }
                onChange={(e) =>
                  setFilters(
                    (prev) => ({
                      ...prev,

                      fromDate:
                        e.target.value
                    })
                  )
                }
              />
            </Col>


            <Col
              md={6}
              lg={3}
            >
              <Form.Label className="small text-muted mb-1">
                Invoice Date To
              </Form.Label>

              <Form.Control
                type="date"
                value={
                  filters.toDate
                }
                onChange={(e) =>
                  setFilters(
                    (prev) => ({
                      ...prev,

                      toDate:
                        e.target.value
                    })
                  )
                }
              />
            </Col>


            <Col
              md={6}
              lg={3}
            >
              <Form.Label className="small text-muted mb-1">
                Due Date From
              </Form.Label>

              <Form.Control
                type="date"
                value={
                  filters.dueFrom
                }
                onChange={(e) =>
                  setFilters(
                    (prev) => ({
                      ...prev,

                      dueFrom:
                        e.target.value
                    })
                  )
                }
              />
            </Col>


            <Col
              md={6}
              lg={3}
            >
              <Form.Label className="small text-muted mb-1">
                Due Date To
              </Form.Label>

              <Form.Control
                type="date"
                value={
                  filters.dueTo
                }
                onChange={(e) =>
                  setFilters(
                    (prev) => ({
                      ...prev,

                      dueTo:
                        e.target.value
                    })
                  )
                }
              />
            </Col>

          </Row>

        </Card.Body>

      </Card>


      {/* =====================================================
          INVOICE TABLE
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
                  Invoice Made
                </th>

                <th>
                  Invoice
                </th>

                <th>
                  Approval
                </th>

                <th>
                  Customer PO / Customer
                </th>

                <th>
                  Invoice Date
                </th>

                <th>
                  Due Date
                </th>

                <th className="text-end">
                  Basic Amount
                </th>

                <th className="text-end">
                  GST / Tax
                </th>

                <th className="text-end">
                  Final Invoice
                </th>

                <th className="text-end">
                  Settled
                </th>

                <th className="text-end">
                  Outstanding
                </th>

                <th>
                  Payment Status
                </th>

                <th>
                  Document
                </th>

                {canManage && (
                  <th className="text-end">
                    Action
                  </th>
                )}

              </tr>

            </thead>


            <tbody>

              {loading ? (

                <tr>

                  <td
                    colSpan={
                      canManage
                        ? 14
                        : 13
                    }
                    className="text-center py-5"
                  >
                    <Spinner
                      size="sm"
                      className="me-2"
                    />

                    Loading invoices...
                  </td>

                </tr>

              ) : data.length ===
                0 ? (

                <tr>

                  <td
                    colSpan={
                      canManage
                        ? 14
                        : 13
                    }
                    className="text-center py-5 text-muted"
                  >
                    No invoices registered.
                  </td>

                </tr>

              ) : (

                data.map(
                  (invoice) => {

                    const approvalStatus =
                      invoiceApprovalStatus(
                        invoice
                      );

                    const approved =
                      isInvoiceApproved(
                        invoice
                      );

                    const editPending =
                      hasPendingEdit(
                        invoice
                      );

                    return (

                      <tr
                        key={
                          invoice._id
                        }
                        className={
                          approvalStatus ===
                            'REJECTED'
                            ? 'opacity-75'
                            : ''
                        }
                      >

                        {/* =================================
                            INVOICE MADE

                            Only APPROVED invoice is
                            financially made.
                        ================================= */}

                        <td>

                          <Badge
                            bg={
                              approved
                                ? 'success'
                                : approvalStatus ===
                                    'PENDING'
                                  ? 'warning'
                                  : 'secondary'
                            }
                            text={
                              approvalStatus ===
                                'PENDING'
                                ? 'dark'
                                : undefined
                            }
                            className="fw-normal"
                          >
                            {approved
                              ? 'Yes'
                              : approvalStatus ===
                                  'PENDING'
                                ? 'Pending'
                                : 'No'}
                          </Badge>

                        </td>


                        {/* NUMBER */}

                        <td
                          style={{
                            minWidth: 160
                          }}
                        >

                          <div className="fw-semibold">
                            {invoice.invoiceNumber}
                          </div>

                          {num(
                            invoice.revisionNo
                          ) > 0 && (
                            <small className="text-muted d-block mt-1">
                              Current Revision:{' '}

                              {num(
                                invoice.revisionNo
                              )}
                            </small>
                          )}

                        </td>


                        {/* APPROVAL */}

                        <td
                          style={{
                            minWidth: 190
                          }}
                        >

                          <ApprovalBadge
                            invoice={
                              invoice
                            }
                          />

                        </td>


                        {/* PO / CUSTOMER */}

                        <td
                          style={{
                            minWidth: 220
                          }}
                        >

                          {(invoice.poAllocations?.length
                            ? invoice.poAllocations
                            : [{ po: invoice.po, allocatedAmount: invoice.totalInvoiceAmount }]
                          ).map((allocation, poIndex) => {
                            const poRecord = typeof allocation.po === 'object'
                              ? allocation.po
                              : (pos.find(p => String(p._id) === String(allocation.po)) || (poIndex === 0 ? invoice.po : null));
                            return (
                              <div key={poIndex} className={poIndex ? 'mt-2 pt-2 border-top' : ''}>
                                <div className="fw-semibold">{poRecord?.poNumber || `PO ${poIndex + 1}`}</div>
                                <small className="text-muted d-block">{customerName(poRecord)}</small>
                                <small className="text-muted d-block">Allocated: {money(allocation.allocatedAmount)}</small>
                              </div>
                            );
                          })}



                          {vendorCode(
                            invoice.po
                          ) && (
                            <small className="text-muted d-block">
                              Vendor Code:{' '}

                              {vendorCode(
                                invoice.po
                              )}
                            </small>
                          )}

                        </td>


                        {/* DATE */}

                        <td className="text-nowrap">
                          {date(
                            invoice.invoiceDate
                          )}
                        </td>


                        {/* DUE */}

                        <td className="text-nowrap">
                          {invoice.invoiceDueDate
                            ? date(
                                invoice.invoiceDueDate
                              )
                            : '—'}
                        </td>


                        {/* BASIC */}

                        <td className="text-end text-nowrap">
                          {money(
                            invoice.invoiceAmount
                          )}
                        </td>


                        {/* GST */}

                        <td className="text-end text-nowrap">

                          <div>
                            {money(
                              invoice.gstTaxAmount
                            )}
                          </div>

                          {invoice.gstTaxPercent !==
                            undefined &&
                            invoice.gstTaxPercent !==
                              null && (

                              <small className="text-muted">

                                {num(
                                  invoice.gstTaxPercent
                                ).toFixed(
                                  2
                                )}
                                %

                              </small>
                            )}

                        </td>


                        {/* TOTAL */}

                        <td className="text-end text-nowrap fw-semibold">

                          <div>
                            {money(
                              invoice.totalInvoiceAmount
                            )}
                          </div>

                          {Math.abs(
                            num(
                              invoice.roundOffAmount
                            )
                          ) >
                            0.0001 && (

                            <small className="text-muted fw-normal">

                              Round:{' '}

                              {num(
                                invoice.roundOffAmount
                              ) > 0
                                ? '+'
                                : ''}

                              {num(
                                invoice.roundOffAmount
                              ).toFixed(
                                2
                              )}

                            </small>
                          )}

                        </td>


                        {/* SETTLED */}

                        <td className="text-end text-nowrap">

                          {approved
                            ? money(
                                invoice.paidAmount
                              )
                            : (
                              <span className="text-muted">
                                —
                              </span>
                            )}

                        </td>


                        {/* OUTSTANDING */}

                        <td className="text-end text-nowrap fw-semibold">

                          {approved
                            ? money(
                                invoice.outstandingAmount
                              )
                            : (
                              <span className="text-muted">
                                —
                              </span>
                            )}

                        </td>


                        {/* PAYMENT STATUS */}

                        <td>

                          {approved ? (

                            <StatusBadge
                              value={
                                invoice.paymentStatus
                              }
                            />

                          ) : (

                            <Badge
                              bg="light"
                              text="dark"
                              className="border fw-normal"
                            >
                              Not Financially Active
                            </Badge>

                          )}

                        </td>


                        {/* DOCUMENT */}

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


                        {/* EDIT */}

                        {canManage && (

                          <td className="text-end">

                            {approved &&
                            !editPending ? (

                              <Button
                                type="button"
                                size="sm"
                                variant="outline-primary"
                                title="Submit invoice edit for approval"
                                onClick={() =>
                                  openEditModal(
                                    invoice
                                  )
                                }
                              >
                                <i className="bi bi-pencil-square" />
                              </Button>

                            ) : (

                              <Button
                                type="button"
                                size="sm"
                                variant="light"
                                disabled
                                title={
                                  approvalStatus ===
                                    'PENDING'
                                    ? 'Invoice approval is pending'
                                    : approvalStatus ===
                                        'REJECTED'
                                      ? 'Rejected invoice cannot be edited'
                                      : 'Invoice edit approval is pending'
                                }
                              >
                                {editPending ? (
                                  <i className="bi bi-clock-history" />
                                ) : (
                                  <i className="bi bi-pencil-square" />
                                )}
                              </Button>

                            )}

                          </td>

                        )}

                      </tr>
                    );
                  }
                )

              )}

            </tbody>

          </Table>

        </div>

      </Card>


      {/* =====================================================
          CREATE / EDIT TALLY INVOICE
      ===================================================== */}

      <Modal
        show={show}
        onHide={
          closeModal
        }
        size="xl"
        centered
        dialogClassName="invoice-entry-dialog"
        backdrop="static"
      >

        <Form
          onSubmit={
            save
          }
        >

          <Modal.Header
            closeButton
          >

            <Modal.Title>

              {isEditing
                ? 'Edit Tally Invoice'
                : 'Register Tally Invoice'}

            </Modal.Title>

          </Modal.Header>


          <Modal.Body className="invoice-entry-body">

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


            <div className="invoice-entry-intro mb-3">
              <div>
                <strong>{isEditing ? 'Update invoice details' : 'New sales invoice'}</strong>
                <div className="text-muted small">Select one customer PO, verify its available balance, then complete the invoice details.</div>
              </div>
              <span className="invoice-entry-step">Customer PO &amp; Invoice Details</span>
            </div>

            {isEditing &&
              editingInvoice && (

                <Card className="border mb-3">

                  <Card.Body className="py-2">

                    <div className="d-flex flex-wrap align-items-center gap-2">

                      <span className="small text-muted">
                        Current Invoice:
                      </span>

                      <strong>
                        {editingInvoice.invoiceNumber}
                      </strong>

                      <Badge
                        bg="success"
                        className="fw-normal"
                      >
                        Approved
                      </Badge>

                      {num(
                        editingInvoice.revisionNo
                      ) > 0 && (

                        <Badge
                          bg="light"
                          text="dark"
                          className="border fw-normal"
                        >
                          Rev{' '}
                          {num(
                            editingInvoice.revisionNo
                          )}
                        </Badge>

                      )}

                    </div>

                  </Card.Body>

                </Card>

              )}


            <Row className="g-3">


              {/* =============================================
                  SINGLE CUSTOMER PO
              ============================================= */}
              <Col xs={12}>
                <section className="invoice-po-panel">
                  <div className="invoice-section-top">
                    <div>
                      <div className="invoice-section-eyebrow">STEP 01</div>
                      <h6 className="mb-1">Customer PO details</h6>
                      <div className="text-muted small">Select one Customer PO for this Tally invoice.</div>
                    </div>
                  </div>
                  <Row className="g-2 mt-1">
                    <Col xs={12}>
                      <Form.Label className="fw-semibold">Select Customer PO *</Form.Label>
                      <Form.Select required value={form.po} disabled={isEditing}
                        onChange={e => updatePOSelection(e.target.value)}>
                        <option value="">Select Customer PO</option>
                        {availablePOs.map(po => <option key={po._id} value={po._id}>
                          {po.poNumber} — {customerName(po)} — Available {money(
                            isEditing && getId(editingInvoice?.po) === String(po._id)
                              ? num(po.financialSummary?.uninvoicedAmount) + num(editingInvoice?.totalInvoiceAmount)
                              : po.financialSummary?.uninvoicedAmount
                          )}
                        </option>)}
                      </Form.Select>
                    </Col>
                  </Row>
                  {selectedPO && (
                    <>
                      <div className="invoice-allocation-summary mt-3">
                        <div><span className="text-muted">PO Value</span><strong>{money(selectedPO.totalPOAmount)}</strong></div>
                        <div><span className="text-muted">Available PO Balance</span><strong>{money(availableForInvoice)}</strong></div>
                        <div><span className="text-muted">Final Invoice Total</span><strong>{money(form.totalInvoiceAmount)}</strong></div>
                      </div>
                      <div className="invoice-selected-po-card mt-3">
                        <div className="fw-semibold mb-2">{selectedPO.poNumber}</div>
                        <Row className="g-2">
                          <Col md={6}><span className="invoice-detail-label">Customer</span><strong className="invoice-detail-value">{customerName(selectedPO)}</strong></Col>
                          <Col md={6}><span className="invoice-detail-label">Customer Code</span><strong className="invoice-detail-value">{customerCode(selectedPO) || '—'}</strong></Col>
                          <Col md={6}><span className="invoice-detail-label">Our Vendor Code</span><strong className="invoice-detail-value">{vendorCode(selectedPO) || '—'}</strong></Col>
                          <Col md={6}><span className="invoice-detail-label">Customer GSTIN</span><strong className="invoice-detail-value">{customerGSTIN(selectedPO) || '—'}</strong></Col>
                          <Col md={6}><span className="invoice-detail-label">Previously Invoiced</span><strong className="invoice-detail-value">{money(selectedPO.financialSummary?.totalInvoiced)}</strong></Col>
                        </Row>
                      </div>
                    </>
                  )}
                  {isEditing && <div className="text-muted small mt-2">PO selection is locked during editing to protect existing payment allocations.</div>}
                </section>
              </Col>

              <Col xs={12}>
                <hr className="my-1" />
              </Col>


              {/* =============================================
                  INVOICE DETAILS
              ============================================= */}

              <Col md={6}>

                <Form.Label>
                  Invoice Number *
                </Form.Label>

                <Form.Control
                  required
                  maxLength={
                    100
                  }
                  value={
                    form.invoiceNumber
                  }
                  placeholder="Enter invoice number exactly as in Tally"
                  onChange={(e) =>
                    setForm(
                      (prev) => ({
                        ...prev,

                        invoiceNumber:
                          e.target.value
                            .toUpperCase()
                      })
                    )
                  }
                />

              </Col>


              <Col md={2}>
                <Form.Label>Invoice Date *</Form.Label>
                <Form.Control
                  required
                  type="date"
                  value={form.invoiceDate}
                  onChange={(e) => {
                    const invoiceDate = e.target.value;
                    setForm(prev => ({
                      ...prev,
                      invoiceDate,
                      invoiceDueDate: calculateDueDate(invoiceDate, prev.paymentTermDays)
                    }));
                  }}
                />
              </Col>

              <Col md={2}>
                <Form.Label>Payment Terms (Days) *</Form.Label>
                <Form.Control
                  required
                  type="number"
                  min="0"
                  max="3650"
                  step="1"
                  placeholder="e.g. 45"
                  value={form.paymentTermDays}
                  onChange={(e) => {
                    const paymentTermDays = e.target.value;
                    setForm(prev => ({
                      ...prev,
                      paymentTermDays,
                      invoiceDueDate: calculateDueDate(prev.invoiceDate, paymentTermDays)
                    }));
                  }}
                />
              </Col>

              <Col md={2}>
                <Form.Label>Invoice Due Date *</Form.Label>
                <Form.Control
                  required
                  type="date"
                  readOnly
                  value={form.invoiceDueDate}
                />
                <Form.Text>Auto: Invoice Date + Terms</Form.Text>
              </Col>

              {/* DELIVERY / E-WAY BILL / CLOSURE */}
              <Col md={4}>
                <Form.Label>Invoice Closure</Form.Label>
                <Form.Select value={form.invoiceClosureStatus || 'OPEN'} onChange={(e) => setForm(p => ({...p, invoiceClosureStatus: e.target.value}))}>
                  <option value="OPEN">Open</option><option value="CLOSED">Closed</option>
                </Form.Select>
              </Col>
              <Col md={4}>
                <Form.Label>Material / Item Delivered?</Form.Label>
                <Form.Select value={form.materialDelivered || 'NO'} onChange={(e) => setForm(p => ({...p, materialDelivered: e.target.value, actualDeliveryDate: e.target.value === 'YES' ? p.actualDeliveryDate : ''}))}>
                  <option value="NO">No</option><option value="YES">Yes</option>
                </Form.Select>
              </Col>
              {form.materialDelivered === 'YES' && <Col md={4}>
                <Form.Label>Actual Delivery Date *</Form.Label>
                <Form.Control type="date" required value={form.actualDeliveryDate || ''} onChange={(e) => setForm(p => ({...p, actualDeliveryDate: e.target.value}))}/>
              </Col>}
              <Col md={4}>
                <Form.Label>E-Way Bill Number (if applicable)</Form.Label>
                <Form.Control maxLength={50} value={form.eWayBillNumber || ''} onChange={(e) => setForm(p => ({...p, eWayBillNumber: e.target.value}))}/>
              </Col>


              {/* =============================================
                  FINANCIAL VALUES
              ============================================= */}

              <Col md={4}>

                <Form.Label>
                  Taxable / Basic Amount *
                </Form.Label>

                <Form.Control
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={
                    form.invoiceAmount
                  }
                  placeholder="Example: 53130"
                  onChange={(e) =>
                    setForm(
                      (prev) => ({
                        ...prev,

                        invoiceAmount:
                          e.target.value
                      })
                    )
                  }
                />

              </Col>


              <Col md={2}>

                <Form.Label>
                  GST / Tax % *
                </Form.Label>

                <Form.Control
                  required
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={
                    form.gstTaxPercent
                  }
                  placeholder="18"
                  onChange={(e) =>
                    setForm(
                      (prev) => ({
                        ...prev,

                        gstTaxPercent:
                          e.target.value
                      })
                    )
                  }
                />

                <Form.Text className="text-muted">
                  CGST 9% + SGST 9% = 18%
                </Form.Text>

              </Col>


              <Col md={3}>

                <Form.Label>
                  GST / Tax Amount
                </Form.Label>

                <Form.Control
                  readOnly
                  value={
                    form.gstTaxAmount
                  }
                />

                <Form.Text className="text-muted">
                  Auto calculated
                </Form.Text>

              </Col>


              <Col md={3}>

                <Form.Label>
                  Round Off
                </Form.Label>

                <Form.Control
                  type="number"
                  step="0.01"
                  value={
                    form.roundOffAmount
                  }
                  placeholder="0.00"
                  onChange={(e) =>
                    setForm(
                      (prev) => ({
                        ...prev,

                        roundOffAmount:
                          e.target.value
                      })
                    )
                  }
                />

                <Form.Text className="text-muted">
                  Example: -0.40 or +0.25
                </Form.Text>

              </Col>


              {/* =============================================
                  CALCULATION PREVIEW
              ============================================= */}

              <Col md={12}>

                <Card className="border bg-light">

                  <Card.Body className="py-3">

                    <Row className="g-3">

                      <Col md={3}>

                        <small className="text-muted d-block">
                          Basic Amount
                        </small>

                        <strong>
                          {money(
                            form.invoiceAmount
                          )}
                        </strong>

                      </Col>


                      <Col md={3}>

                        <small className="text-muted d-block">

                          GST ({num(
                            form.gstTaxPercent
                          ).toFixed(
                            2
                          )}%)

                        </small>

                        <strong>
                          {money(
                            form.gstTaxAmount
                          )}
                        </strong>

                      </Col>


                      <Col md={3}>

                        <small className="text-muted d-block">
                          Round Off
                        </small>

                        <strong>

                          {num(
                            form.roundOffAmount
                          ) >= 0
                            ? '+'
                            : ''}

                          {num(
                            form.roundOffAmount
                          ).toFixed(
                            2
                          )}

                        </strong>

                      </Col>


                      <Col md={3}>

                        <small className="text-muted d-block">
                          Final Invoice Amount
                        </small>

                        <strong className="fs-5">
                          {money(
                            form.totalInvoiceAmount
                          )}
                        </strong>

                      </Col>

                    </Row>

                    <div className="small text-muted mt-2">
                      Final Invoice = Basic Amount + GST Amount + Round Off
                    </div>

                  </Card.Body>

                </Card>

              </Col>


              {/* =============================================
                  PO BALANCE PREVIEW
              ============================================= */}

              {selectedPO && (

                <Col md={12}>

                  <Card className="border bg-light">

                    <Card.Body className="py-3">

                      <Row className="g-3">

                        <Col md={4}>

                          <small className="text-muted d-block">
                            PO Value
                          </small>

                          <strong>
                            {money(
                              selectedPO
                                .totalPOAmount
                            )}
                          </strong>

                        </Col>


                        <Col md={4}>

                          <small className="text-muted d-block">
                            Available Before this Invoice
                          </small>

                          <strong>
                            {money(
                              availableForInvoice
                            )}
                          </strong>

                        </Col>


                        <Col md={4}>

                          <small className="text-muted d-block">
                            Remaining After Invoice
                          </small>

                          <strong>
                            {money(
                              Math.max(
                                0,

                                availableForInvoice -
                                  num(
                                    form.totalInvoiceAmount
                                  )
                              )
                            )}
                          </strong>

                        </Col>

                      </Row>

                    </Card.Body>

                  </Card>

                </Col>

              )}


              {/* =============================================
                  TALLY DOCUMENT
              ============================================= */}

              <Col md={6}>

                <Form.Label>

                  Invoice Document

                  {!isEditing &&
                    ' *'}

                </Form.Label>

                <Form.Control
                  required={
                    !isEditing
                  }
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.htm,.html,.txt"
                  onChange={
                    handleFileChange
                  }
                />

                <Form.Text className="text-muted">

                  {isEditing
                    ? 'Leave blank to keep the current approved Tally invoice document. A replacement document will become active only after edit approval.'
                    : 'Upload invoice generated from Tally. PDF, DOC, DOCX, JPG, JPEG or PNG. Maximum 10 MB.'}

                </Form.Text>


                {isEditing &&
                  editingInvoice
                    ?.invoiceDocument
                    ?.originalName && (

                    <div className="mt-2">

                      <Badge
                        bg="light"
                        text="dark"
                        className="border fw-normal"
                      >
                        Current:{' '}

                        {
                          editingInvoice
                            .invoiceDocument
                            .originalName
                        }

                      </Badge>

                    </div>

                  )}


                {file && (

                  <div className="mt-2">

                    <Badge
                      bg="light"
                      text="dark"
                      className="border fw-normal"
                    >
                      <i className="bi bi-paperclip me-1" />

                      {file.name}

                    </Badge>

                  </div>

                )}

              </Col>


              {/* =============================================
                  REMARKS
              ============================================= */}

              <Col md={6}>

                <Form.Label>
                  Remarks
                </Form.Label>

                <Form.Control
                  as="textarea"
                  rows={3}
                  maxLength={
                    1000
                  }
                  value={
                    form.remarks
                  }
                  placeholder="Optional internal remarks"
                  onChange={(e) =>
                    setForm(
                      (prev) => ({
                        ...prev,

                        remarks:
                          e.target.value
                      })
                    )
                  }
                />

              </Col>

            </Row>

          </Modal.Body>


          <Modal.Footer className="invoice-entry-footer">

            <Button
              type="button"
              variant="light"
              disabled={
                saving
              }
              onClick={
                closeModal
              }
            >
              Cancel
            </Button>


            <Button
              type="submit"
              className="primary-btn"
              disabled={
                saving
              }
            >

              {saving ? (

                <>

                  <Spinner
                    size="sm"
                    className="me-2"
                  />

                  {isEditing
                    ? 'Saving Changes...'
                    : 'Saving...'}

                </>

              ) : (

                isEditing
                  ? 'Save Invoice Changes'
                  : 'Save Invoice'

              )}

            </Button>

          </Modal.Footer>

        </Form>

      </Modal>

    </>
  );
}