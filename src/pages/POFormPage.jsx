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
  Row,
  Table
} from 'react-bootstrap';
import {
  useNavigate
} from 'react-router-dom';
import api from '../api/client';
import {
  money
} from '../utils/format';
import PageHeader from '../components/PageHeader';
/* =========================================================
   COMPANY GST STATE
   THETAVEGA GSTIN starts with 27 = Maharashtra.
   This is used only to give a sensible default:
   Maharashtra Customer -> CGST + SGST
   Other State Customer -> IGST
   User can still edit tax rates line-wise.
\========================================================= */
const OUR_GST_STATE_CODE = '27';
/* =========================================================
   BLANK PO ITEM
\========================================================= */
const blank = () => ({
  item: null,
  positionNo: '',
  itemCode: '',
  materialCode: '',
  itemType: 'SERVICE',
  description: '',
  hsnSac: '',
  uom: 'EA',
  quantity: 1,
  rate: 0,
  discountPercent: 0,
  cgstRate: 0,
  sgstRate: 0,
  igstRate: 0,
  cessRate: 0
});
/* =========================================================
   NUMBER HELPER
\========================================================= */
function num(value) {
  const n = Number(value || 0);
  return Number.isFinite(n)
    ? n
    : 0;
}
/* =========================================================
   ITEM CALCULATION
   This is FRONTEND PREVIEW only.
   Backend PO.js calculates the authoritative values again.
\========================================================= */
function calculateLine(item, gstPriceMode = "EXCLUSIVE") {
  const quantity =
    num(item.quantity);
  const rate =
    num(item.rate);
  const grossAmount =
    quantity * rate;
  const discountAmount =
    grossAmount *
    num(item.discountPercent) /
    100;
  const enteredAmount = Math.max(0, grossAmount - discountAmount);
  const totalRate = num(item.cgstRate) + num(item.sgstRate) + num(item.igstRate);
  const taxableAmount = gstPriceMode === 'INCLUSIVE'
    ? enteredAmount / (1 + totalRate / 100)
    : enteredAmount;
  const cgstAmount =
    taxableAmount *
    num(item.cgstRate) /
    100;
  const sgstAmount =
    taxableAmount *
    num(item.sgstRate) /
    100;
  const igstAmount =
    taxableAmount *
    num(item.igstRate) /
    100;
  const cessAmount =
    taxableAmount *
    num(item.cessRate) /
    100;
  const taxAmount =
    cgstAmount +
    sgstAmount +
    igstAmount +
    cessAmount;
  const totalAmount =
    taxableAmount +
    taxAmount;
  return {
    grossAmount,
    discountAmount,
    taxableAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    cessAmount,
    taxAmount,
    totalAmount
  };
}
/* =========================================================
   COMPONENT
\========================================================= */
export default function POFormPage() {
  const go =
    useNavigate();
  const [customerSearch, setCustomerSearch] = useState('');
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectError, setProjectError] = useState('');
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [
    customers,
    setCustomers
  ] = useState([]);
  const [
    users,
    setUsers
  ] = useState([]);
  const [
    itemsMaster,
    setItemsMaster
  ] = useState([]);
  const [
    items,
    setItems
  ] = useState([
    blank()
  ]);
  const [
    form,
    setForm
  ] = useState({
    /* Customer */
    customer: '',
    project: '',
    /* Customer PO */
    poNumber: '',
    poDate:
      new Date()
        .toISOString()
        .slice(0, 10),
    poType: 'SERVICE',
    gstPriceMode: 'EXCLUSIVE',
    customerPOFinalAmount: '',
    /* Customer Buyer */
    customerBuyerName: '',
    customerBuyerContact: '',
    /* Delivery / Completion */
    expectedCompletionDate: '',
    deliveryLocation: '',
    deliveryTerms: '',
    completionTerms: '',
    /* Ownership */
    responsiblePerson: '',
    /* Commercial */
    roundOffAmount: 0,
    remarks: ''
  });
  const [
    file,
    setFile
  ] = useState(null);
  const [
    err,
    setErr
  ] = useState('');
  const [
    busy,
    setBusy
  ] = useState(false);
  const [
    loading,
    setLoading
  ] = useState(true);
  // Optional advance receipt collected on the same New PO screen.
  const [addAdvanceNow, setAddAdvanceNow] = useState(false);
  const [advance, setAdvance] = useState({
    amount: '', receivedDate: new Date().toLocaleDateString('en-CA'),
    paymentMode: 'NEFT', referenceNo: '', remarks: '', tdsRate: '', tdsBaseAmount: '', otherDeductions: 0
  });
  const [advanceTdsOptions, setAdvanceTdsOptions] = useState([]);
  const advanceFY = (() => {
    const [year, month] = String(advance.receivedDate || '').split('-').map(Number);
    if (!year || !month) return '';
    const first = month >= 4 ? year : year - 1;
    return `${first}-${String((first + 1) % 100).padStart(2,'0')}`;
  })();
  useEffect(() => {
    let active = true;
    setAdvanceTdsOptions([]);
    if (!addAdvanceNow || !advanceFY) return;
    api.get('/payments/tds-options', { params: { year: advanceFY } })
      .then(response => { if (active) setAdvanceTdsOptions(response.data?.data || []); })
      .catch(() => { if (active) setAdvanceTdsOptions([]); });
    return () => { active = false; };
  }, [addAdvanceNow, advanceFY]);
  const advanceDay = String(advance.receivedDate || '').slice(0,10);
  const activeAdvanceRates = advanceTdsOptions.filter(rate =>
    rate.isActive !== false &&
    (!rate.effectiveFrom || advanceDay >= String(rate.effectiveFrom).slice(0,10)) &&
    (!rate.effectiveTo || advanceDay <= String(rate.effectiveTo).slice(0,10))
  );
  const selectedAdvanceRate = activeAdvanceRates.find(x => x._id === advance.tdsRate);
  const advanceTdsAmount = Math.round(Number(advance.tdsBaseAmount || 0) * Number(selectedAdvanceRate?.rate || 0)) / 100;
  const advanceBankNet = Number(advance.amount || 0) - advanceTdsAmount - Number(advance.otherDeductions || 0);
  const [createdPoId, setCreatedPoId] = useState(null);
  const [advanceSaveError, setAdvanceSaveError] = useState('');
  const updateAdvance = (field, value) =>
    setAdvance(previous => ({ ...previous, [field]: value }));

  /* =========================================================
     LOAD MASTER DATA
  ========================================================= */
  useEffect(() => {
    async function loadMasters() {
      try {
        setLoading(true);
        setErr('');
        const [
          customerResponse,
          userResponse,
          itemResponse
        ] =
          await Promise.all([
            api.get(
              '/masters/customers'
            ),
            api
              .get('/users')
              .catch(() => ({
                data: {
                  data: []
                }
              })),
            api.get(
              '/masters/items'
            )
          ]);
        setCustomers(
          (
            customerResponse
              .data
              .data || []
          ).filter(
            (customer) =>
              customer.isActive !==
              false
          )
        );
        setUsers(
          (
            userResponse
              .data
              .data || []
          ).filter(
            (user) =>
              user.isActive !==
              false
          )
        );
        setItemsMaster(
          (
            itemResponse
              .data
              .data || []
          ).filter(
            (item) =>
              item.isActive !==
              false
          )
        );
      } catch (error) {
        setErr(
          error.response
            ?.data
            ?.message ||
            'Unable to load PO master data.'
        );
      } finally {
        setLoading(false);
      }
    }
    loadMasters();
  }, []);
  /* =========================================================
     PROJECTS FOR SELECTED CUSTOMER
     Project selection is optional for legacy compatibility.
  ========================================================= */
  useEffect(() => {
    let cancelled = false;
    setProjects([]);
    setProjectError('');
    if (!form.customer) {
      setProjectsLoading(false);
      return () => { cancelled = true; };
    }
    setProjectsLoading(true);
    api.get('/masters/projects', {
      params: { customer: form.customer, isActive: true }
    }).then(response => {
      if (!cancelled) setProjects(response.data.data || []);
    }).catch(error => {
      if (!cancelled) setProjectError(error.response?.data?.message || 'Unable to load projects for this customer.');
    }).finally(() => {
      if (!cancelled) setProjectsLoading(false);
    });
    return () => { cancelled = true; };
  }, [form.customer]);

  /* =========================================================
     SELECTED CUSTOMER
  ========================================================= */
  const selectedCustomer =
    useMemo(() => {
      return customers.find(
        (customer) =>
          customer._id ===
          form.customer
      );
    }, [
      customers,
      form.customer
    ]);
  /* =========================================================
     DEFAULT TAX TYPE
     Customer state same as THETAVEGA -> CGST + SGST.
     Other state -> IGST.
     Item master currently keeps one default GST %.
\========================================================= */
  function defaultTaxRates(
    gstPercent,
    customer = selectedCustomer
  ) {
    const gst =
      num(gstPercent);
    if (!gst) {
      return {
        cgstRate: 0,
        sgstRate: 0,
        igstRate: 0
      };
    }
    if (
      String(
        customer?.stateCode ||
          ''
      ) ===
      OUR_GST_STATE_CODE
    ) {
      return {
        cgstRate:
          gst / 2,
        sgstRate:
          gst / 2,
        igstRate:
          0
      };
    }
    return {
      cgstRate: 0,
      sgstRate: 0,
      igstRate: gst
    };
  }
  /* =========================================================
     CUSTOMER CHANGE
     Re-apply default tax structure to items that came
     from Item Master.
     Existing rate percentages are recalculated based on
     the item's defaultTaxPercent.
  ========================================================= */
  function handleCustomerChange(
    customerId
  ) {
    const customer =
      customers.find(
        (x) =>
          x._id === customerId
      );
    setForm((prev) => ({
      ...prev,
      customer: customerId,
      project: '', // Clear project when customer changes.
      /*
        Shipping address from Customer Master is a useful
        default delivery location.
        User may edit it.
      */
      deliveryLocation:
        prev.deliveryLocation ||
        customer
          ?.shippingAddress ||
        customer
          ?.billingAddress ||
        ''
    }));
    setItems((current) =>
      current.map((line) => {
        const master =
          itemsMaster.find(
            (x) =>
              x._id ===
                line.item ||
              x.itemCode ===
                line.itemCode
          );
        if (!master) {
          return line;
        }
        const tax =
          defaultTaxRates(
            master.defaultTaxPercent,
            customer
          );
        return {
          ...line,
          ...tax
        };
      })
    );
  }
  /* =========================================================
     PO TOTALS
  ========================================================= */
  const totals =
    useMemo(() => {
      const value =
        items.reduce(
          (acc, item) => {
            const line =
              calculateLine(item, form.gstPriceMode);
            acc.gross +=
              line.grossAmount;
            acc.discount +=
              line.discountAmount;
            acc.basic +=
              line.taxableAmount;
            acc.cgst +=
              line.cgstAmount;
            acc.sgst +=
              line.sgstAmount;
            acc.igst +=
              line.igstAmount;
            acc.cess +=
              line.cessAmount;
            acc.tax +=
              line.taxAmount;
            acc.total +=
              line.totalAmount;
            return acc;
          },
          {
            gross: 0,
            discount: 0,
            basic: 0,
            cgst: 0,
            sgst: 0,
            igst: 0,
            cess: 0,
            tax: 0,
            total: 0
          }
        );
      value.roundOff =
        num(
          form.roundOffAmount
        );
      value.grandTotal =
        value.total +
        value.roundOff;
      return value;
    }, [
      items,
      form.roundOffAmount,
      form.gstPriceMode
    ]);
  /* =========================================================
     UPDATE ITEM
  ========================================================= */
  function update(
    index,
    key,
    value
  ) {
    setItems((current) =>
      current.map(
        (item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                [key]: value
              }
            : item
      )
    );
  }
  /* =========================================================
     CHOOSE ITEM / SERVICE MASTER
  ========================================================= */
  function chooseItem(
    index,
    code
  ) {
    const master =
      itemsMaster.find(
        (item) =>
          item.itemCode ===
          code
      );
    if (!master) {
      return;
    }
    const tax =
      defaultTaxRates(
        master.defaultTaxPercent
      );
    setItems((current) =>
      current.map(
        (
          item,
          itemIndex
        ) =>
          itemIndex === index
            ? {
                ...item,
                item:
                  master._id,
                itemCode:
                  master.itemCode,
                description:
                  master.description,
                hsnSac:
                  master.hsnSac,
                materialCode: master.materialCode || '',
                itemType: form.poType === 'MATERIAL' ? 'MATERIAL' : form.poType === 'SERVICE' ? 'SERVICE' : (master.itemType || 'SERVICE'),
                rate:
                  num(
                    master.defaultRate
                  ),
                ...tax
              }
            : item
      )
    );
  }
  /* =========================================================
     TAX INPUT HELPERS
     Important rule:
     CGST/SGST and IGST cannot be used together.
  ========================================================= */
  function updateTaxRate(
    index,
    key,
    value
  ) {
    const rate =
      value;
    setItems((current) =>
      current.map(
        (
          item,
          itemIndex
        ) => {
          if (
            itemIndex !== index
          ) {
            return item;
          }
          const updated = {
            ...item,
            [key]: rate
          };
          /*
            If user enters IGST,
            clear CGST + SGST.
          */
          if (
            key ===
              'igstRate' &&
            num(rate) > 0
          ) {
            updated.cgstRate =
              0;
            updated.sgstRate =
              0;
          }
          /*
            If user enters CGST or SGST,
            clear IGST.
          */
          if (
            (
              key ===
                'cgstRate' ||
              key ===
                'sgstRate'
            ) &&
            num(rate) > 0
          ) {
            updated.igstRate =
              0;
          }
          return updated;
        }
      )
    );
  }
  /* =========================================================
     ADD / REMOVE ITEM
  ========================================================= */
  function addItem() {
    setItems((current) => [
      ...current,
      blank()
    ]);
  }
  function removeItem(index) {
    setItems((current) =>
      current.filter(
        (_, itemIndex) =>
          itemIndex !== index
      )
    );
  }
  /* =========================================================
     FILE
  ========================================================= */
function handleFileChange(event) {
  setErr('');

  const selected = event.target.files?.[0];
  if (!selected) {
    setFile(null);
    return;
  }

  const allowed = [
    '.pdf', '.doc', '.docx',
    '.xls', '.xlsx',
    '.jpg', '.jpeg', '.png', '.webp',
    '.htm', '.html', '.txt'
  ];

  const extension = selected.name
    .toLowerCase()
    .slice(selected.name.lastIndexOf('.'));

  if (!allowed.includes(extension)) {
    setErr('Unsupported document format.');
    setFile(null);
    event.target.value = '';
    return;
  }

  if (selected.size > 10 * 1024 * 1024) {
    setErr('Maximum file size is 10 MB.');
    setFile(null);
    event.target.value = '';
    return;
  }

  setFile(selected);
}
  /* =========================================================
     SUBMIT
  ========================================================= */
  async function submit(event) {
    event.preventDefault();
    try {
      setBusy(true);
      setErr('');
      if (!form.customer) {
        setErr('Please select an existing customer from the suggestions.');
        return;
      }
      /* -----------------------------------------------------
         DOCUMENT REQUIRED
      ----------------------------------------------------- */
      if (!file) {
        setErr(
          'Customer PO document is required.'
        );
        return;
      }
      /* -----------------------------------------------------
         DATE CHECK
      ----------------------------------------------------- */
      if (
        form.poDate &&
        form.expectedCompletionDate &&
        new Date(
          form.expectedCompletionDate
        ) <
          new Date(
            form.poDate
          )
      ) {
        setErr(
          'Expected completion date cannot be before the PO date.'
        );
        return;
      }
      if (form.customerPOFinalAmount === '' || Math.abs(num(form.customerPOFinalAmount) - Number(totals.grandTotal.toFixed(2))) > 0.01) {
        setErr('Customer PO Final Amount does not match calculated amount. Check quantity, rate and GST.');
        return;
      }
      if (addAdvanceNow && !createdPoId) {
        const amount = Number(advance.amount);
        if (!Number.isFinite(amount) || amount <= 0 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001 ||
            !advance.receivedDate || !advance.referenceNo.trim() || advanceBankNet < 0 ||
            (advance.tdsRate && (!selectedAdvanceRate || Number(advance.tdsBaseAmount || 0) <= 0 || Number(advance.tdsBaseAmount) > amount))) {
          setErr('For an immediate advance, enter a positive amount (maximum two decimals), received date and transaction reference.');
          return;
        }
      }
      /* -----------------------------------------------------
         ITEM VALIDATION
      ----------------------------------------------------- */
      const invalidTax =
        items.some(
          (item) =>
            num(
              item.igstRate
            ) > 0 &&
            (
              num(
                item.cgstRate
              ) > 0 ||
              num(
                item.sgstRate
              ) > 0
            )
        );
      if (invalidTax) {
        setErr(
          'Use either CGST/SGST or IGST for each PO item, not both.'
        );
        return;
      }
      /* -----------------------------------------------------
         REQUEST ITEMS
         Do not send calculated amounts.
         Backend PO.js calculates:
         poAmount
         discountAmount
         taxAmount
         CGST/SGST/IGST amount
         totalAmount
      ----------------------------------------------------- */
      const requestItems =
        items.map(
          (item) => ({
            item:
              item.item ||
              null,
            materialCode: String(item.materialCode || '').trim().toUpperCase(),
            itemType: form.poType === 'MATERIAL' ? 'MATERIAL' : form.poType === 'SERVICE' ? 'SERVICE' : item.itemType,
            positionNo:
              String(
                item.positionNo ||
                  ''
              ).trim(),
            itemCode:
              String(
                item.itemCode ||
                  ''
              )
                .trim()
                .toUpperCase(),
            description:
              String(
                item.description ||
                  ''
              ).trim(),
            hsnSac:
              String(
                item.hsnSac ||
                  ''
              ).trim(),
            uom:
              String(
                item.uom ||
                  'EA'
              )
                .trim()
                .toUpperCase(),
            quantity:
              num(
                item.quantity
              ),
            rate:
              num(
                item.rate
              ),
            discountPercent: 0,
            /*
              UI currently uses discount percentage.
              Backend supports fixed discount also,
              but we intentionally send zero here.
            */
            discountAmount:
              0,
            cgstRate:
              num(
                item.cgstRate
              ),
            sgstRate:
              num(
                item.sgstRate
              ),
            igstRate:
              num(
                item.igstRate
              ),
            cessRate: 0
          })
        );
      /* -----------------------------------------------------
         REQUEST PAYLOAD
      ----------------------------------------------------- */
      const payload = {
        customer:
          form.customer,
        project: form.project || null,
        poNumber:
          String(
            form.poNumber ||
              ''
          )
            .trim()
            .toUpperCase(),
        poDate:
          form.poDate,
        poType:
          form.poType,
        gstPriceMode: form.gstPriceMode,
        customerPOFinalAmount: num(form.customerPOFinalAmount),
        customerBuyerName:
          String(
            form.customerBuyerName ||
              ''
          ).trim(),
        customerBuyerContact:
          String(
            form.customerBuyerContact ||
              ''
          ).trim(),
        expectedCompletionDate:
          form.expectedCompletionDate,
        deliveryLocation:
          String(
            form.deliveryLocation ||
              ''
          ).trim(),
        deliveryTerms:
          String(
            form.deliveryTerms ||
              ''
          ).trim(),
        completionTerms:
          String(
            form.completionTerms ||
              ''
          ).trim(),
        responsiblePerson:
          form.responsiblePerson,
        items:
          requestItems,
        roundOffAmount:
          num(
            form.roundOffAmount
          ),
        remarks:
          String(
            form.remarks ||
              ''
          ).trim()
      };
      /* -----------------------------------------------------
         MULTIPART
      ----------------------------------------------------- */
      const fd =
        new FormData();
      fd.append(
        'data',
        JSON.stringify(
          payload
        )
      );
      fd.append(
        'poDocument',
        file
      );
      // If an earlier advance-save attempt failed, do NOT create the PO again.
      const poId = createdPoId || (await api.post('/pos', fd)).data.data._id;
      setCreatedPoId(poId);
      if (addAdvanceNow) {
        try {
          await api.post(`/pos/${poId}/advances`, {
            ...advance, amount: Number(advance.amount),
            tdsRate: advance.tdsRate || null, tdsBaseAmount: advance.tdsRate ? Number(advance.tdsBaseAmount) : 0,
            otherDeductions: Number(advance.otherDeductions || 0)
          });
        } catch (advanceError) {
          // PO has already been created. Keep its ID and allow safe retry.
          const message = advanceError.response?.data?.message || 'Unable to save advance receipt.';
          setAdvanceSaveError(`PO was created successfully, but its advance was NOT saved: ${message}. Do not create a second PO. Retry below or open this PO and record the advance there.`);
          setErr('');
          return;
        }
      }
      go(`/pos/${poId}`);
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
            'Unable to create Customer PO.'
        );
      }
    } finally {
      setBusy(false);
    }
  }
  /* =========================================================
     UI
  ========================================================= */
  return (
    <>
      <PageHeader
        title="Create Customer PO"
        subtitle="Capture the customer order, commercial details, PO items, execution owner and original Customer PO document."
      />
      <Form
        onSubmit={
          submit
        }
      >
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
        {/* =================================================
            CUSTOMER
        ================================================= */}
        <Card className="form-card mb-3">
          <Card.Body>
            <h5 className="mb-3">
              Customer
            </h5>
            <Row className="g-3">
              <Col md={6}>
                <Form.Label>
                  Customer *
                </Form.Label>
                {/* Search and choose within ONE customer dropdown. Only existing customers are allowed. */}
                <div
                  className="position-relative"
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                      setCustomerDropdownOpen(false);
                    }
                  }}
                >
                  <Form.Control
                    type="text"
                    role="combobox"
                    aria-label="Search customer"
                    aria-autocomplete="list"
                    aria-expanded={customerDropdownOpen}
                    autoComplete="off"
                    placeholder="Select or type customer name / code..."
                    disabled={loading}
                    value={customerSearch}
                    onFocus={() => setCustomerDropdownOpen(true)}
                    onChange={(event) => {
                      setCustomerSearch(event.target.value);
                      setCustomerDropdownOpen(true);
                      // A typed string is not a valid customer selection.
                      // Clear old selection until an existing customer is chosen.
                      if (form.customer) handleCustomerChange('');
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') setCustomerDropdownOpen(false);
                      if (event.key === 'ArrowDown') setCustomerDropdownOpen(true);
                    }}
                  />
                  {customerDropdownOpen && (
                    <div
                      role="listbox"
                      className="position-absolute w-100 bg-body border rounded shadow-sm mt-1"
                      style={{
                        zIndex: 1050,
                        maxHeight: 340,
                        overflowY: 'auto',
                        padding: '6px',
                        minWidth: '100%',
                        fontSize: '15px'
                      }}
                    >
                      {customers
                        .filter((customer) =>
                          `${customer.name || ''} ${customer.code || ''}`
                            .toLowerCase()
                            .includes(customerSearch.trim().toLowerCase())
                        )
                        .map((customer) => (
                          <button
                            type="button"
                            role="option"
                            aria-selected={form.customer === customer._id}
                            key={customer._id}
                            className="dropdown-item text-start text-wrap rounded"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              width: '100%',
                              minHeight: '48px',
                              padding: '12px 14px',
                              fontSize: '15px',
                              fontWeight: 500,
                              lineHeight: 1.5,
                              whiteSpace: 'normal'
                            }}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              handleCustomerChange(customer._id);
                              setCustomerSearch(`${customer.name} (${customer.code})`);
                              setCustomerDropdownOpen(false);
                            }}
                          >
                            {customer.name} ({customer.code})
                          </button>
                        ))}
                      {!customers.some((customer) =>
                        `${customer.name || ''} ${customer.code || ''}`
                          .toLowerCase()
                          .includes(customerSearch.trim().toLowerCase())
                      ) && (
                        <div className="px-3 py-3 text-muted" style={{ fontSize: 15 }}>No matching customer</div>
                      )}
                    </div>
                  )}
                </div>
              </Col>
              <Col md={6}>
                <Form.Label>Project</Form.Label>
                <Form.Select
                  value={form.project || ''}
                  disabled={!form.customer || projectsLoading}
                  onChange={event => setForm(previous => ({ ...previous, project: event.target.value }))}
                >
                  <option value="">{projectsLoading ? 'Loading projects...' : 'No Project / Select Project'}</option>
                  {projects.map(project => (
                    <option key={project._id} value={project._id}>
                      {project.code} — {project.name}
                    </option>
                  ))}
                </Form.Select>
                {projectError ? (
                  <Form.Text className="text-danger">{projectError}</Form.Text>
                ) : (
                  <Form.Text className="text-muted">
                    Only active projects of the selected customer are shown.
                    Create a project under Masters first if needed.
                  </Form.Text>
                )}
              </Col>
              {selectedCustomer && (
                <>
                  <Col md={3}>
                    <Form.Label>
                      Our Vendor Code
                    </Form.Label>
                    <Form.Control
                      value={
                        selectedCustomer.vendorCode ||
                        ''
                      }
                      readOnly
                    />
                  </Col>
                  <Col md={3}>
                    <Form.Label>
                      GSTIN
                    </Form.Label>
                    <Form.Control
                      value={
                        selectedCustomer.gstin ||
                        ''
                      }
                      readOnly
                    />
                  </Col>
                  <Col md={3}>
                    <Form.Label>
                      State
                    </Form.Label>
                    <Form.Control
                      value={
                        selectedCustomer.state ||
                        ''
                      }
                      readOnly
                    />
                  </Col>
                  <Col md={3}>
                    <Form.Label>
                      State Code
                    </Form.Label>
                    <Form.Control
                      value={
                        selectedCustomer.stateCode ||
                        ''
                      }
                      readOnly
                    />
                  </Col>
                  <Col md={6}>
                    <Form.Label>
                      Billing Address
                    </Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      value={
                        selectedCustomer.billingAddress ||
                        ''
                      }
                      readOnly
                    />
                  </Col>
                </>
              )}
            </Row>
          </Card.Body>
        </Card>
        {/* =================================================
            CUSTOMER PO DETAILS
        ================================================= */}
        <Card className="form-card mb-3">
          <Card.Body>
            <h5 className="mb-3">
              Customer PO Details
            </h5>
            <Row className="g-3">
              <Col md={4}>
                <Form.Label>
                  Customer PO
                  Number *
                </Form.Label>
                <Form.Control
                  required
                  maxLength={
                    100
                  }
                  value={
                    form.poNumber
                  }
                  placeholder="Enter customer PO number"
                  onChange={(e) =>
                    setForm(
                      (
                        prev
                      ) => ({
                        ...prev,
                        poNumber:
                          e.target.value.toUpperCase()
                      })
                    )
                  }
                />
              </Col>
              <Col md={4}>
                <Form.Label>
                  Customer PO
                  Date *
                </Form.Label>
                <Form.Control
                  required
                  type="date"
                  value={
                    form.poDate
                  }
                  onChange={(e) =>
                    setForm(
                      (
                        prev
                      ) => ({
                        ...prev,
                        poDate:
                          e
                            .target
                            .value
                      })
                    )
                  }
                />
              </Col>
              <Col md={4}>
                <Form.Label>
                  PO Type *
                </Form.Label>
                <Form.Select
                  required
                  value={
                    form.poType
                  }
                  onChange={(e) =>
                    setForm(
                      (
                        prev
                      ) => ({
                        ...prev,
                        poType:
                          e
                            .target
                            .value
                      })
                    )
                  }
                >
                  <option value="SERVICE">
                    Service
                  </option>
                  <option value="MATERIAL">
                    Material
                  </option>
                  <option value="MATERIAL_AND_SERVICE">
                    Material +
                    Service
                  </option>
                  <option value="OTHER">
                    Other
                  </option>
                </Form.Select>
              </Col>
              <Col md={4}>
                <Form.Label>GST Pricing *</Form.Label>
                <Form.Select value={form.gstPriceMode} onChange={e => setForm(v => ({...v, gstPriceMode:e.target.value}))}>
                  <option value="EXCLUSIVE">GST Exclusive</option>
                  <option value="INCLUSIVE">GST Inclusive</option>
                </Form.Select>
              </Col>
              <Col md={4}>
                <Form.Label>Customer PO Final Amount (₹) *</Form.Label>
                <Form.Control required type="number" min="0" step="0.01" value={form.customerPOFinalAmount} onChange={e => setForm(v => ({...v,customerPOFinalAmount:e.target.value}))} />
                <Form.Text className={form.customerPOFinalAmount !== '' && Math.abs(num(form.customerPOFinalAmount) - totals.grandTotal)>0.01 ? 'text-danger':'text-success'}>
                  Calculated: {money(totals.grandTotal)} | Difference: {money(num(form.customerPOFinalAmount) - totals.grandTotal)}
                </Form.Text>
              </Col>
              <Col md={4}>
                <Form.Label>
                  Expected
                  Completion /
                  Delivery *
                </Form.Label>
                <Form.Control
                  required
                  type="date"
                  min={
                    form.poDate
                  }
                  value={
                    form.expectedCompletionDate
                  }
                  onChange={(e) =>
                    setForm(
                      (
                        prev
                      ) => ({
                        ...prev,
                        expectedCompletionDate:
                          e
                            .target
                            .value
                      })
                    )
                  }
                />
              </Col>
              <Col md={4}>
                <Form.Label>
                  Responsible
                  Person *
                </Form.Label>
                <Form.Select
                  required
                  value={
                    form.responsiblePerson
                  }
                  onChange={(e) =>
                    setForm(
                      (
                        prev
                      ) => ({
                        ...prev,
                        responsiblePerson:
                          e
                            .target
                            .value
                      })
                    )
                  }
                >
                  <option value="">
                    Select owner
                  </option>
                  {users.map(
                    (user) => (
                      <option
                        key={
                          user._id
                        }
                        value={
                          user._id
                        }
                      >
                        {
                          user.name
                        }
                      </option>
                    )
                  )}
                </Form.Select>
              </Col>
            </Row>
          </Card.Body>
        </Card>
        {/* =================================================
            CUSTOMER BUYER
        ================================================= */}
        <Card className="form-card mb-3">
          <Card.Body>
            <h5 className="mb-3">
              Customer Buyer
            </h5>
            <Row className="g-3">
              <Col md={6}>
                <Form.Label>
                  Responsible Person Name
                </Form.Label>
                <Form.Control
                  value={
                    form.customerBuyerName
                  }
                  placeholder="e.g. Pankaj Mahajan"
                  onChange={(e) =>
                    setForm(
                      (
                        prev
                      ) => ({
                        ...prev,
                        customerBuyerName:
                          e
                            .target
                            .value
                      })
                    )
                  }
                />
              </Col>
              <Col md={6}>
                <Form.Label>
                  Buyer Contact /
                  Code
                </Form.Label>
                <Form.Control
                  value={
                    form.customerBuyerContact
                  }
                  placeholder="Phone / email / buyer code"
                  onChange={(e) =>
                    setForm(
                      (
                        prev
                      ) => ({
                        ...prev,
                        customerBuyerContact:
                          e
                            .target
                            .value
                      })
                    )
                  }
                />
              </Col>
            </Row>
          </Card.Body>
        </Card>
        {/* =================================================
            DELIVERY / COMPLETION
        ================================================= */}
        <Card className="form-card mb-3">
          <Card.Body>
            <h5 className="mb-3">
              Delivery &
              Completion
            </h5>
            <Row className="g-3">
              <Col md={12}>
                <Form.Label>
                  Delivery
                  Location
                </Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={
                    form.deliveryLocation
                  }
                  placeholder="Customer plant / delivery location"
                  onChange={(e) =>
                    setForm(
                      (
                        prev
                      ) => ({
                        ...prev,
                        deliveryLocation:
                          e
                            .target
                            .value
                      })
                    )
                  }
                />
              </Col>
              <Col md={6}>
                <Form.Label>
                  Terms Of Delivery
                </Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={
                    form.deliveryTerms
                  }
                  placeholder="Example: As per Delivery Schedule"
                  onChange={(e) =>
                    setForm(
                      (
                        prev
                      ) => ({
                        ...prev,
                        deliveryTerms:
                          e
                            .target
                            .value
                      })
                    )
                  }
                />
              </Col>
              <Col md={6}>
                <Form.Label>
                  Terms of Payment
                </Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={
                    form.completionTerms
                  }
                  placeholder="Example: Immediate after Job Completion"
                  onChange={(e) =>
                    setForm(
                      (
                        prev
                      ) => ({
                        ...prev,
                        completionTerms:
                          e
                            .target
                            .value
                      })
                    )
                  }
                />
              </Col>
            </Row>
          </Card.Body>
        </Card>
        {/* =================================================
            PO ITEMS
        ================================================= */}
        <Card className="form-card mb-3">
          <Card.Body>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h5 className="mb-1">
                  PO Items /
                  Services
                </h5>
                <small className="text-muted">
                  Enter what
                  THETAVEGA is
                  supplying or
                  executing against
                  this Customer PO.
                </small>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline-primary"
                onClick={
                  addItem
                }
              >
                <i className="bi bi-plus-lg me-1" />
                Add Item
              </Button>
            </div>
            <div className="table-responsive">
              <Table className="entry-table align-middle">
                <thead>
                  <tr>
                    <th
                      style={{
                        minWidth:
                          75
                      }}
                    >
                      Pos.
                    </th>
                    <th
                      style={{
                        minWidth:
                          130
                      }}
                    >
                      Item /
                      Service Code
                    </th>
                    <th>Material Code</th><th>Type</th><th
                      style={{
                        minWidth:
                          240
                      }}
                    >
                      Description
                    </th>
                    <th
                      style={{
                        minWidth:
                          100
                      }}
                    >
                      HSN / SAC
                    </th>
                    <th
                      style={{
                        minWidth:
                          75
                      }}
                    >
                      UOM
                    </th>
                    <th
                      style={{
                        minWidth:
                          90
                      }}
                    >
                      Qty
                    </th>
                    <th
                      style={{
                        minWidth:
                          110
                      }}
                    >
                      Rate
                    </th>
                    
                    <th
                      style={{
                        minWidth:
                          90
                      }}
                    >
                      CGST %
                    </th>
                    <th
                      style={{
                        minWidth:
                          90
                      }}
                    >
                      SGST %
                    </th>
                    <th
                      style={{
                        minWidth:
                          90
                      }}
                    >
                      IGST %
                    </th>
                    
                    <th
                      style={{
                        minWidth:
                          120
                      }}
                    >
                      Taxable
                    </th>
                    <th
                      style={{
                        minWidth:
                          120
                      }}
                    >
                      Tax
                    </th>
                    <th
                      style={{
                        minWidth:
                          130
                      }}
                    >
                      Total
                    </th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map(
                    (
                      item,
                      index
                    ) => {
                      const line =
                        calculateLine(item, form.gstPriceMode);
                      return (
                        <tr
                          key={
                            index
                          }
                        >
                          <td>
                            <Form.Control
                              value={
                                item.positionNo
                              }
                              placeholder="010"
                              onChange={(
                                e
                              ) =>
                                update(
                                  index,
                                  'positionNo',
                                  e
                                    .target
                                    .value
                                )
                              }
                            />
                          </td>
                          <td>
                            <Form.Control
                              list="po-items-list"
                              required
                              value={
                                item.itemCode
                              }
                              onChange={(
                                e
                              ) => {
                                const value =
                                  e.target.value.toUpperCase();
                                update(
                                  index,
                                  'itemCode',
                                  value
                                );
                                chooseItem(
                                  index,
                                  value
                                );
                              }}
                            />
                            <datalist id="po-items-list">
                              {itemsMaster.map(
                                (
                                  master
                                ) => (
                                  <option
                                    key={
                                      master._id
                                    }
                                    value={
                                      master.itemCode
                                    }
                                  >
                                    {
                                      master.description
                                    }
                                  </option>
                                )
                              )}
                            </datalist>
                          </td>
                          <td><Form.Control value={item.materialCode || ''} placeholder="Material code" onChange={e=>update(index,'materialCode',e.target.value.toUpperCase())}/></td>
                          <td><Form.Select value={form.poType === 'MATERIAL' ? 'MATERIAL' : form.poType === 'SERVICE' ? 'SERVICE' : (item.itemType || 'SERVICE')} disabled={form.poType === 'MATERIAL' || form.poType === 'SERVICE'} onChange={e=>update(index,'itemType',e.target.value)}><option value="MATERIAL">Material</option><option value="SERVICE">Service</option></Form.Select></td>
                          <td>
                            <Form.Control
                              required
                              value={
                                item.description
                              }
                              onChange={(
                                e
                              ) =>
                                update(
                                  index,
                                  'description',
                                  e
                                    .target
                                    .value
                                )
                              }
                            />
                          </td>
                          <td><small className="text-muted">{(form.poType === 'MATERIAL' || (form.poType !== 'SERVICE' && item.itemType === 'MATERIAL')) ? 'HSN' : 'SAC'}</small>
                            <Form.Control
                              required
                              value={
                                item.hsnSac
                              }
                              onChange={(
                                e
                              ) =>
                                update(
                                  index,
                                  'hsnSac',
                                  e
                                    .target
                                    .value
                                )
                              }
                            />
                          </td>
                          <td>
                            <Form.Control
                              required
                              value={
                                item.uom
                              }
                              onChange={(
                                e
                              ) =>
                                update(
                                  index,
                                  'uom',
                                  e.target.value.toUpperCase()
                                )
                              }
                            />
                          </td>
                          <td>
                            <Form.Control
                              required
                              type="number"
                              min="0.0001"
                              step="0.0001"
                              value={
                                item.quantity
                              }
                              onChange={(
                                e
                              ) =>
                                update(
                                  index,
                                  'quantity',
                                  e
                                    .target
                                    .value
                                )
                              }
                            />
                          </td>
                          <td>
                            <Form.Control
                              required
                              type="number"
                              min="0"
                              step="0.01"
                              value={
                                item.rate
                              }
                              onChange={(
                                e
                              ) =>
                                update(
                                  index,
                                  'rate',
                                  e
                                    .target
                                    .value
                                )
                              }
                            />
                          </td>
                          
                          <td>
                            <Form.Control
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={
                                item.cgstRate
                              }
                              onChange={(
                                e
                              ) =>
                                updateTaxRate(
                                  index,
                                  'cgstRate',
                                  e
                                    .target
                                    .value
                                )
                              }
                            />
                          </td>
                          <td>
                            <Form.Control
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={
                                item.sgstRate
                              }
                              onChange={(
                                e
                              ) =>
                                updateTaxRate(
                                  index,
                                  'sgstRate',
                                  e
                                    .target
                                    .value
                                )
                              }
                            />
                          </td>
                          <td>
                            <Form.Control
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={
                                item.igstRate
                              }
                              onChange={(
                                e
                              ) =>
                                updateTaxRate(
                                  index,
                                  'igstRate',
                                  e
                                    .target
                                    .value
                                )
                              }
                            />
                          </td>
                          
                          <td className="fw-semibold text-nowrap">
                            {money(
                              line.taxableAmount
                            )}
                          </td>
                          <td className="text-nowrap">
                            {money(
                              line.taxAmount
                            )}
                          </td>
                          <td className="fw-semibold text-nowrap">
                            {money(
                              line.totalAmount
                            )}
                          </td>
                          <td>
                            {items.length >
                              1 && (
                              <Button
                                type="button"
                                size="sm"
                                variant="link"
                                className="text-danger p-1"
                                onClick={() =>
                                  removeItem(
                                    index
                                  )
                                }
                              >
                                <i className="bi bi-trash" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </Table>
            </div>
            {/* =================================================
                TOTALS
            ================================================= */}
            <Row className="justify-content-end mt-4">
              <Col
                lg={5}
                xl={4}
              >
                <div className="totals-box">
                  <div>
                    <span>
                      Gross
                      Amount
                    </span>
                    <b>
                      {money(
                        totals.gross
                      )}
                    </b>
                  </div>
                  {totals.discount >
                    0 && (
                    <div>
                      <span>
                        Discount
                      </span>
                      <b>
                        -
                        {money(
                          totals.discount
                        )}
                      </b>
                    </div>
                  )}
                  <div>
                    <span>
                      PO /
                      Taxable
                      Amount
                    </span>
                    <b>
                      {money(
                        totals.basic
                      )}
                    </b>
                  </div>
                  {totals.cgst >
                    0 && (
                    <div>
                      <span>
                        CGST
                      </span>
                      <b>
                        {money(
                          totals.cgst
                        )}
                      </b>
                    </div>
                  )}
                  {totals.sgst >
                    0 && (
                    <div>
                      <span>
                        SGST
                      </span>
                      <b>
                        {money(
                          totals.sgst
                        )}
                      </b>
                    </div>
                  )}
                  {totals.igst >
                    0 && (
                    <div>
                      <span>
                        IGST
                      </span>
                      <b>
                        {money(
                          totals.igst
                        )}
                      </b>
                    </div>
                  )}
                  {totals.cess >
                    0 && (
                    <div>
                      <span>
                        Cess
                      </span>
                      <b>
                        {money(
                          totals.cess
                        )}
                      </b>
                    </div>
                  )}
                  <div>
                    <span>
                      Total GST /
                      Tax
                    </span>
                    <b>
                      {money(
                        totals.tax
                      )}
                    </b>
                  </div>
                  <div className="align-items-center">
                    <span>
                      Round Off
                    </span>
                    <div
                      style={{
                        width: 120
                      }}
                    >
                      <Form.Control
                        type="number"
                        size="sm"
                        step="0.01"
                        value={
                          form.roundOffAmount
                        }
                        onChange={(
                          e
                        ) =>
                          setForm(
                            (
                              prev
                            ) => ({
                              ...prev,
                              roundOffAmount:
                                e
                                  .target
                                  .value
                            })
                          )
                        }
                      />
                    </div>
                  </div>
                  <div className="grand">
                    <span>
                      Total
                      Customer PO
                    </span>
                    <b>
                      {money(
                        totals.grandTotal
                      )}
                    </b>
                  </div>
                </div>
              </Col>
            </Row>
          </Card.Body>
        </Card>
        {/* OPTIONAL CUSTOMER ADVANCE AT PO CREATION */}
        <Card className="form-card mb-3">
          <Card.Body>
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
              <div>
                <h5 className="mb-1">Customer Advance Received</h5>
                <div className="text-muted small">Record money already received from the customer at the time of creating this PO.</div>
              </div>
              <Form.Check type="switch" id="advance-at-po-creation" label="Record advance in Payments when PO is saved"
                checked={addAdvanceNow} disabled={Boolean(createdPoId)}
                onChange={event => setAddAdvanceNow(event.target.checked)} />
            </div>
            {addAdvanceNow && <Row className="g-3 mt-1">
              <Col md={6}><Form.Label>Advance Amount (₹) *</Form.Label>
                <Form.Control required type="number" min="0.01" step="0.01" value={advance.amount}
                  onChange={event => updateAdvance('amount', event.target.value)} /></Col>
              <Col md={6}><Form.Label>Payment Received Date *</Form.Label>
                <Form.Control required type="date" value={advance.receivedDate}
                  onChange={event => setAdvance(a => ({ ...a, receivedDate: event.target.value, tdsRate: '', tdsBaseAmount: '' }))} /></Col>
              <Col md={6}><Form.Label>Payment Mode *</Form.Label>
                <Form.Select value={advance.paymentMode} onChange={event => updateAdvance('paymentMode', event.target.value)}>
                  {['NEFT', 'RTGS', 'IMPS', 'UPI', 'CHEQUE', 'CASH', 'OTHER'].map(mode => <option key={mode} value={mode}>{mode}</option>)}
                </Form.Select></Col>
              <Col md={6}><Form.Label>UTR / Transaction Reference *</Form.Label>
                <Form.Control required maxLength={120} value={advance.referenceNo}
                  onChange={event => updateAdvance('referenceNo', event.target.value)} /></Col>
              <Col md={4}><Form.Label>TDS Financial Year</Form.Label><Form.Control value={advanceFY || '—'} readOnly /></Col>
              <Col md={8}><Form.Label>TDS Master Rate (optional)</Form.Label><Form.Select value={advance.tdsRate} onChange={e => {
                updateAdvance('tdsRate', e.target.value);
              }}><option value="">No TDS</option>{activeAdvanceRates.map(rate => <option key={rate._id} value={rate._id}>{rate.section} — {rate.description} — {rate.rate}%</option>)}</Form.Select>
                <Form.Text>Choose the applicable rate; TDS is not mandatory for every advance.</Form.Text></Col>
              {advance.tdsRate && <Col md={4}><Form.Label>Taxable Base (excluding GST) ₹ *</Form.Label>
                <Form.Control required type="number" min="0.01" max={advance.amount} step="0.01" value={advance.tdsBaseAmount} onChange={e => updateAdvance('tdsBaseAmount', e.target.value)} /></Col>}
              <Col md={4}><Form.Label>TDS Amount ₹</Form.Label><Form.Control readOnly value={advanceTdsAmount.toFixed(2)} /></Col>
              <Col md={4}><Form.Label>Other Deductions ₹</Form.Label><Form.Control type="number" min="0" step="0.01" value={advance.otherDeductions} onChange={e => updateAdvance('otherDeductions', e.target.value)}/></Col>
              <Col md={4}><Form.Label>Net Bank Received ₹</Form.Label><Form.Control readOnly value={advanceBankNet.toFixed(2)} /></Col>
              <Col xs={12}><Form.Label>Advance Remarks</Form.Label>
                <Form.Control as="textarea" rows={2} maxLength={1000} value={advance.remarks}
                  onChange={event => updateAdvance('remarks', event.target.value)} /></Col>
              <Col xs={12}><small className="text-muted">Each receipt is linked to this PO. Additional receipts can be recorded on the PO Details page.</small></Col>
            </Row>}
            {advanceSaveError && <Alert variant="warning" className="mt-3 mb-0">
              {advanceSaveError}
              {createdPoId && <div className="mt-2"><Button type="button" variant="outline-primary" size="sm" onClick={() => go(`/pos/${createdPoId}`)}>Open created PO</Button></div>}
            </Alert>}
          </Card.Body>
        </Card>
        {/* =================================================
            DOCUMENT / REMARKS
        ================================================= */}
        <Card className="form-card mb-3">
          <Card.Body>
            <h5 className="mb-3">
              Customer PO
              Document
            </h5>
            <Row className="g-3">
              <Col md={6}>
                <Form.Label>
                  Customer PO PDF
                  *
                </Form.Label>
                <Form.Control
                  required
                  type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.htm,.html,.txt"
                  onChange={
                    handleFileChange
                  }
                />
                <Form.Text className="text-muted">
                  Upload the
                  original Customer
                  PO document in PDF
                  format.
                </Form.Text>
                {file && (
                  <div className="mt-2">
                    <Badge
                      bg="light"
                      text="dark"
                      className="border fw-normal"
                    >
                      {
                        file.name
                      }
                    </Badge>
                  </div>
                )}
              </Col>
              <Col md={6}>
                <Form.Label>
                  Remarks
                </Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  maxLength={
                    2000
                  }
                  value={
                    form.remarks
                  }
                  placeholder="Optional internal remarks"
                  onChange={(e) =>
                    setForm(
                      (
                        prev
                      ) => ({
                        ...prev,
                        remarks:
                          e
                            .target
                            .value
                      })
                    )
                  }
                />
              </Col>
            </Row>
          </Card.Body>
        </Card>
        {/* =================================================
            ACTIONS
        ================================================= */}
        <div className="d-flex justify-content-end gap-2 mb-4">
          <Button
            type="button"
            variant="light"
            disabled={
              busy
            }
            onClick={() =>
              go('/pos')
            }
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="primary-btn"
            disabled={
              busy ||
              loading
            }
          >
            {busy
              ? 'Saving...'
              : createdPoId ? 'Retry Advance Save' : 'Create Customer PO'}
          </Button>
        </div>
      </Form>
    </>
  );
}
