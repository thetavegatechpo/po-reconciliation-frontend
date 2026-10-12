import { useEffect, useMemo, useState } from 'react';

import {

  Alert,

  Badge,

  Button,

  Card,

  Col,

  Form,

  Modal,

  Row,

  Tab,

  Tabs,

  Table

} from 'react-bootstrap';

import api from '../api/client';

import PageHeader from '../components/PageHeader';

import { money } from '../utils/format';

import { useAuth } from '../context/AuthContext';
import ProjectMasterPage from './ProjectMasterPage';
import TdsMasterPage from './TdsMasterPage';

/* =========================================================

   GST AUTO DERIVATION

\\========================================================= */

const GST_STATE_MAP = {

  '01': 'Jammu and Kashmir',

  '02': 'Himachal Pradesh',

  '03': 'Punjab',

  '04': 'Chandigarh',

  '05': 'Uttarakhand',

  '06': 'Haryana',

  '07': 'Delhi',

  '08': 'Rajasthan',

  '09': 'Uttar Pradesh',

  '10': 'Bihar',

  '11': 'Sikkim',

  '12': 'Arunachal Pradesh',

  '13': 'Nagaland',

  '14': 'Manipur',

  '15': 'Mizoram',

  '16': 'Tripura',

  '17': 'Meghalaya',

  '18': 'Assam',

  '19': 'West Bengal',

  '20': 'Jharkhand',

  '21': 'Odisha',

  '22': 'Chhattisgarh',

  '23': 'Madhya Pradesh',

  '24': 'Gujarat',

  '26': 'Dadra and Nagar Haveli and Daman and Diu',

  '27': 'Maharashtra',

  '29': 'Karnataka',

  '30': 'Goa',

  '31': 'Lakshadweep',

  '32': 'Kerala',

  '33': 'Tamil Nadu',

  '34': 'Puducherry',

  '35': 'Andaman and Nicobar Islands',

  '36': 'Telangana',

  '37': 'Andhra Pradesh',

  '38': 'Ladakh'

};

const GST_REGEX =

  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

function deriveGSTDetails(input) {

  const gstin = String(input || '')

    .trim()

    .replace(/\s/g, '')

    .toUpperCase();

  if (!GST_REGEX.test(gstin)) {

    return {

      valid: false,

      gstin,

      pan: '',

      stateCode: '',

      state: ''

    };

  }

  const stateCode = gstin.substring(0, 2);

  const pan = gstin.substring(2, 12);

  const state = GST_STATE_MAP[stateCode] || '';

  return {

    valid: Boolean(state),

    gstin,

    pan,

    stateCode,

    state

  };

}

/* =========================================================

   DEFAULT FORMS

\\========================================================= */

const emptyCustomer = {

  name: '',

  code: '',

  vendorCode: '',

  gstin: '',

  pan: '',

  state: '',

  stateCode: '',

  billingAddress: '',

  shippingAddress: '',

  paymentTermBasis: 'INVOICE_DATE',

  paymentTermsDays: 30,

  paymentTermsRemarks: '',

  remarks: '',

  isActive: true

};

const emptyItem = {

  itemCode: '',

  materialCode: '',

  description: '',

  hsnSac: '',

  defaultRate: 0,

  defaultTaxPercent: 18,

  type: 'SERVICE',

  isActive: true

};

/* =========================================================

   COMPONENT

\\========================================================= */

export default function MastersPage() {

  const { can } = useAuth();

  const [customers, setCustomers] = useState([]);

  const [items, setItems] = useState([]);

  const [kind, setKind] = useState(null);

  const [show, setShow] = useState(false);

  const [form, setForm] = useState({});

  const [editingId, setEditingId] = useState(null);

  const [err, setErr] = useState('');

  const [loading, setLoading] = useState(false);

  const [saving, setSaving] = useState(false);

  const [customerSearch, setCustomerSearch] = useState('');

  /* =========================================================

     LOAD DATA

  ========================================================= */

  async function load() {

    try {

      setLoading(true);

      const [customerResponse, itemResponse] =

        await Promise.all([

          api.get('/masters/customers'),

          api.get('/masters/items')

        ]);

      setCustomers(customerResponse.data.data || []);

      setItems(itemResponse.data.data || []);

    } catch (error) {

      setErr(

        error.response?.data?.message ||

          'Unable to load master data.'

      );

    } finally {

      setLoading(false);

    }

  }

  useEffect(() => {

    load();

  }, []);

  /* =========================================================

     GST DETAILS

  ========================================================= */

  const currentGSTDetails = useMemo(

    () => deriveGSTDetails(form.gstin),

    [form.gstin]

  );

  function handleGSTINChange(event) {

    const value = String(event.target.value || '')

      .replace(/\s/g, '')

      .toUpperCase()

      .slice(0, 15);

    const gst = deriveGSTDetails(value);

    setForm((prev) => ({

      ...prev,

      gstin: gst.gstin,

      /*

        These are display fields.

        Backend derives them again before saving.

      */

      pan: gst.pan,

      stateCode: gst.stateCode,

      state: gst.state

    }));

  }

  /* =========================================================

     CUSTOMER FILTER

  ========================================================= */

  const filteredCustomers = useMemo(() => {

    const search =

      customerSearch.trim().toLowerCase();

    if (!search) {

      return customers;

    }

    return customers.filter((customer) => {

      return [

        customer.code,

        customer.name,

        customer.vendorCode,

        customer.gstin,

        customer.pan,

        customer.state,

        customer.stateCode,

      ]

        .filter(Boolean)

        .some((value) =>

          String(value)

            .toLowerCase()

            .includes(search)

        );

    });

  }, [customers, customerSearch]);

  /* =========================================================

     OPEN ADD

  ========================================================= */

  function open(kindName) {

    setErr('');

    setKind(kindName);

    setEditingId(null);

    if (kindName === 'customer') {

      setForm({

        ...emptyCustomer

      });

    } else {

      setForm({

        ...emptyItem

      });

    }

    setShow(true);

  }

  /* =========================================================

     OPEN CUSTOMER EDIT

  ========================================================= */

  function editCustomer(customer) {

    setErr('');

    setKind('customer');

    setEditingId(customer._id);

    /*

      Re-derive GST values also.

      This ensures old customer records display correct

      PAN / State / State Code from GSTIN.

    */

    const gst =

      deriveGSTDetails(customer.gstin);

    setForm({

      name: customer.name || '',

      code: customer.code || '',

      vendorCode:

        customer.vendorCode || '',

      gstin:

        gst.gstin ||

        customer.gstin ||

        '',

      pan:

        gst.pan ||

        customer.pan ||

        '',

      state:

        gst.state ||

        customer.state ||

        '',

      stateCode:

        gst.stateCode ||

        customer.stateCode ||

        '',

      billingAddress:

        customer.billingAddress || '',

      shippingAddress:

        customer.shippingAddress || '',

      paymentTermBasis:

        customer.paymentTermBasis ||

        'INVOICE_DATE',

      paymentTermsDays:

        customer.paymentTermsDays ?? 30,

      paymentTermsRemarks:

        customer.paymentTermsRemarks ||

        '',

      remarks:

        customer.remarks || '',

      isActive:

        customer.isActive !== undefined

          ? customer.isActive

          : true

    });

    setShow(true);

  }

  /* =========================================================

     CLOSE MODAL

  ========================================================= */

  function closeModal() {

    if (saving) {

      return;

    }

    setShow(false);

    setForm({});

    setKind(null);

    setEditingId(null);

    setErr('');

  }

  /* =========================================================

     CUSTOMER PAYLOAD

     IMPORTANT:

     PAN / State / State Code are NOT sent.

     Backend derives them again from GSTIN.

  ========================================================= */

  function buildCustomerPayload() {

    return {

      name:

        String(form.name || '').trim(),

      vendorCode:

        String(form.vendorCode || '')

          .trim()

          .toUpperCase(),

      gstin:

        String(form.gstin || '')

          .trim()

          .toUpperCase(),

      billingAddress:

        String(

          form.billingAddress || ''

        ).trim(),

      shippingAddress:

        String(

          form.shippingAddress || ''

        ).trim(),

      paymentTermBasis:

        form.paymentTermBasis ||

        'INVOICE_DATE',

      paymentTermsDays:

        Number(

          form.paymentTermsDays ?? 0

        ),

      paymentTermsRemarks:

        String(

          form.paymentTermsRemarks ||

            ''

        ).trim(),

      remarks:

        String(

          form.remarks || ''

        ).trim(),

      isActive:

        form.isActive ?? true

    };

  }

  /* =========================================================

     SAVE

  ========================================================= */

  async function save(event) {

    event.preventDefault();

    try {

      setSaving(true);

      setErr('');

      if (kind === 'customer') {

        const gst =

          deriveGSTDetails(

            form.gstin

          );

        if (!gst.valid) {

          setErr(

            'Please enter a valid GSTIN with a supported GST State Code.'

          );

          return;

        }

        const payload =

          buildCustomerPayload();

        if (editingId) {

          await api.put(

            `/masters/customers/${editingId}`,

            payload

          );

        } else {

          await api.post(

            '/masters/customers',

            payload

          );

        }

      } else {

        await api.post(

          '/masters/items',

          form

        );

      }

      setShow(false);

      setForm({});

      setEditingId(null);

      setKind(null);

      await load();

    } catch (error) {

      const response =

        error.response?.data;

      if (

        response?.errors &&

        Array.isArray(

          response.errors

        ) &&

        response.errors.length

      ) {

        setErr(

          response.errors

            .map(

              (x) =>

                x.message

            )

            .join(' ')

        );

      } else {

        setErr(

          response?.message ||

            'Unable to save master.'

        );

      }

    } finally {

      setSaving(false);

    }

  }

  /* =========================================================

     CUSTOMER STATUS

  ========================================================= */

  async function toggleCustomerStatus(

    customer

  ) {

    try {

      setErr('');

      await api.patch(

        `/masters/customers/${customer._id}/status`,

        {

          isActive:

            !customer.isActive

        }

      );

      await load();

    } catch (error) {

      setErr(

        error.response?.data

          ?.message ||

          'Unable to change customer status.'

      );

    }

  }

  /* =========================================================

     PAYMENT TERM DISPLAY

  ========================================================= */

  function paymentTermsText(

    customer

  ) {

    const days =

      customer.paymentTermsDays ??

      0;

    switch (

      customer.paymentTermBasis

    ) {

      case 'ADVANCE':

        return 'Advance';

      case 'GR_DATE':

        return `${days} Days from GR Date`;

      case 'FIXED_DUE_DATE':

        return 'Fixed Due Date';

      case 'OTHER':

        return (

          customer.paymentTermsRemarks ||

          'Other'

        );

      case 'INVOICE_DATE':

      default:

        return `${days} Days from Invoice Date`;

    }

  }

  /* =========================================================

     UI

  ========================================================= */

  return (

    <>

      <PageHeader

        title="Masters"

        subtitle="Maintain customers, items, projects and financial-year TDS rates in one place."

      />

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

      <Tabs

        defaultActiveKey="customers"

        className="mb-3 clean-tabs"

      >

        {/* =================================================

            CUSTOMER TAB

        ================================================= */}

        <Tab

          eventKey="customers"

          title="Customers"

        >

          <Card className="table-card border-0 shadow-sm">

            <Card.Header className="bg-white border-0 py-3">

              <Row className="align-items-center g-2">

                <Col>

                  <div>

                    <h6 className="mb-1 fw-semibold">

                      Customer Master

                    </h6>

                    <small className="text-muted">

                      Maintain customer,

                      GST, vendor code,

                      address and payment

                      information.

                    </small>

                  </div>

                </Col>

                <Col

                  xs={12}

                  md="auto"

                >

                  <Form.Control

                    size="sm"

                    style={{

                      minWidth: 240

                    }}

                    placeholder="Search customer..."

                    value={

                      customerSearch

                    }

                    onChange={(e) =>

                      setCustomerSearch(

                        e.target.value

                      )

                    }

                  />

                </Col>

                {can('customer.create') && (

                  <Col xs="auto">

                    <Button

                      size="sm"

                      className="primary-btn"

                      onClick={() =>

                        open(

                          'customer'

                        )

                      }

                    >

                      + Add Customer

                    </Button>

                  </Col>

                )}

              </Row>

            </Card.Header>

            <div className="table-responsive">

              <Table className="business-table mb-0 align-middle">

                <thead>

                  <tr>

                    <th>Code</th>

                    <th>

                      Customer

                    </th>

                    <th>

                      Vendor Code

                    </th>

                    <th>GSTIN</th>

                    <th>

                      State

                    </th>

                    <th>

                      Payment Terms

                    </th>

                    <th>

                      Status

                    </th>

                    <th className="text-end">

                      Action

                    </th>

                  </tr>

                </thead>

                <tbody>

                  {loading ? (

                    <tr>

                      <td

                        colSpan="8"

                        className="text-center py-4 text-muted"

                      >

                        Loading

                        customers...

                      </td>

                    </tr>

                  ) : filteredCustomers.length ===

                    0 ? (

                    <tr>

                      <td

                        colSpan="8"

                        className="text-center py-4 text-muted"

                      >

                        No customers

                        found.

                      </td>

                    </tr>

                  ) : (

                    filteredCustomers.map(

                      (

                        customer

                      ) => (

                        <tr

                          key={

                            customer._id

                          }

                        >

                          <td>

                            <span className="fw-semibold">

                              {

                                customer.code

                              }

                            </span>

                          </td>

                          <td>

                            <div className="fw-semibold">

                              {

                                customer.name

                              }

                            </div>

                            {customer.billingAddress && (

                              <small className="text-muted d-block text-truncate">

                                {

                                  customer.billingAddress

                                }

                              </small>

                            )}

                          </td>

                          <td>

                            {customer.vendorCode ||

                              '—'}

                          </td>

                          <td>

                            <div>

                              {customer.gstin ||

                                '—'}

                            </div>

                            {customer.pan && (

                              <small className="text-muted d-block">

                                PAN:{' '}

                                {

                                  customer.pan

                                }

                              </small>

                            )}

                          </td>

                          <td>

                            {customer.state ||

                              '—'}

                            {customer.stateCode && (

                              <small className="d-block text-muted">

                                Code:{' '}

                                {

                                  customer.stateCode

                                }

                              </small>

                            )}

                          </td>

                          <td>

                            {paymentTermsText(

                              customer

                            )}

                          </td>

                          <td>

                            <Badge

                              bg={

                                customer.isActive

                                  ? 'success'

                                  : 'secondary'

                              }

                              className="fw-normal"

                            >

                              {customer.isActive

                                ? 'Active'

                                : 'Inactive'}

                            </Badge>

                          </td>

                          <td className="text-end">

                            {can('customer.edit') && (

                              <Button

                                variant="outline-primary"

                                size="sm"

                                className="me-2"

                                onClick={() =>

                                  editCustomer(

                                    customer

                                  )

                                }

                              >

                                Edit

                              </Button>

                            )}

                            {can('customer.status') && (

                              <Button

                                variant={

                                  customer.isActive

                                    ? 'outline-danger'

                                    : 'outline-success'

                                }

                                size="sm"

                                onClick={() =>

                                  toggleCustomerStatus(

                                    customer

                                  )

                                }

                              >

                                {customer.isActive

                                  ? 'Deactivate'

                                  : 'Activate'}

                              </Button>

                            )}

                          </td>

                        </tr>

                      )

                    )

                  )}

                </tbody>

              </Table>

            </div>

          </Card>

        </Tab>

        {/* =================================================

            ITEM / SERVICE TAB

        ================================================= */}

        <Tab

          eventKey="items"

          title="Items / Services"

        >

          <Card className="table-card border-0 shadow-sm">

            <Card.Header className="bg-white d-flex justify-content-between align-items-center py-3 border-0">

              <div>

                <h6 className="mb-1 fw-semibold">

                  Item & Service

                  Master

                </h6>

                <small className="text-muted">

                  Maintain reusable

                  item and service

                  information.

                </small>

              </div>

              {can('item.create') && (

                <Button

                  size="sm"

                  className="primary-btn"

                  onClick={() =>

                    open('item')

                  }

                >

                  + Add Item

                </Button>

              )}

            </Card.Header>

            <div className="table-responsive">

              <Table className="business-table mb-0 align-middle">

                <thead>

                  <tr>

                    <th>Item Code</th>

                    <th>Material Code</th>

                    <th>

                      Description

                    </th>

                    <th>

                      HSN / SAC

                    </th>

                    <th>Type</th>

                    <th>Rate</th>

                    <th>GST</th>

                  </tr>

                </thead>

                <tbody>

                  {items.map(

                    (item) => (

                      <tr

                        key={

                          item._id

                        }

                      >

                        <td>

                          {

                            item.itemCode

                          }

                        </td>

                        <td>

                          {item.materialCode || '—'}

                        </td>

                        <td>

                          {

                            item.description

                          }

                        </td>

                        <td>

                          {

                            item.hsnSac

                          }

                        </td>

                        <td>

                          {

                            item.type

                          }

                        </td>

                        <td>

                          {money(

                            item.defaultRate

                          )}

                        </td>

                        <td>

                          {

                            item.defaultTaxPercent

                          }

                          %

                        </td>

                      </tr>

                    )

                  )}

                </tbody>

              </Table>

            </div>

          </Card>

        </Tab>

        <Tab eventKey="projects" title="Projects">
          <ProjectMasterPage embedded />
        </Tab>
        <Tab eventKey="tds" title="TDS Rates">
          <TdsMasterPage embedded />
        </Tab>
      </Tabs>

      {/* ===================================================

          ADD / EDIT MODAL

      =================================================== */}

      <Modal

        show={show}

        onHide={closeModal}

        centered

        size={

          kind === 'customer'

            ? 'lg'

            : undefined

        }

        backdrop="static"

      >

        <Form onSubmit={save}>

          <Modal.Header closeButton>

            <Modal.Title>

              {kind ===

              'customer'

                ? `${

                    editingId

                      ? 'Edit'

                      : 'Add'

                  } Customer`

                : 'Add Item / Service'}

            </Modal.Title>

          </Modal.Header>

          <Modal.Body>

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

            {kind ===

            'customer' ? (

              <>

                {/* =========================================

                    CUSTOMER INFORMATION

                ========================================= */}

                <div className="mb-4">

                  <h6 className="fw-semibold mb-3">

                    Customer

                    Information

                  </h6>

                  <Row className="g-3">

                    <Col md={6}>

                      <Form.Label>

                        Customer Name *

                      </Form.Label>

                      <Form.Control

                        required

                        maxLength={

                          150

                        }

                        value={

                          form.name ||

                          ''

                        }

                        placeholder="Enter customer name"

                        onChange={(

                          e

                        ) =>

                          setForm(

                            (

                              prev

                            ) => ({

                              ...prev,

                              name:

                                e

                                  .target

                                  .value

                            })

                          )

                        }

                      />

                    </Col>

                    <Col md={3}>

                        <Form.Label>Customer Code</Form.Label>

                        <Form.Control value={editingId ? (form.code || '') : 'Auto-generated on Save'} readOnly />

                      </Col>

                    <Col md={3}>

                      <Form.Label>

                        Our Vendor Code

                        *

                      </Form.Label>

                      <Form.Control

                        required

                        maxLength={

                          50

                        }

                        value={

                          form.vendorCode ||

                          ''

                        }

                        placeholder="e.g. 214615"

                        onChange={(

                          e

                        ) =>

                          setForm(

                            (

                              prev

                            ) => ({

                              ...prev,

                              vendorCode:

                                e.target.value.toUpperCase()

                            })

                          )

                        }

                      />

                    </Col>

                  </Row>

                </div>

                <hr />

                {/* =========================================

                    GST INFORMATION

                ========================================= */}

                <div className="my-4">

                  <div className="d-flex justify-content-between align-items-center mb-3">

                    <h6 className="fw-semibold mb-0">

                      GST

                      Information

                    </h6>

                    {currentGSTDetails.valid && (

                      <Badge

                        bg="success"

                        className="fw-normal"

                      >

                        Valid GSTIN

                      </Badge>

                    )}

                  </div>

                  <Row className="g-3">

                    <Col md={6}>

                      <Form.Label>

                        GSTIN *

                      </Form.Label>

                      <Form.Control

                        required

                        maxLength={

                          15

                        }

                        value={

                          form.gstin ||

                          ''

                        }

                        placeholder="27AAACE7066P1Z3"

                        onChange={

                          handleGSTINChange

                        }

                        isValid={

                          currentGSTDetails.valid

                        }

                        isInvalid={

                          Boolean(

                            form.gstin

                          ) &&

                          String(

                            form.gstin

                          )

                            .length ===

                            15 &&

                          !currentGSTDetails.valid

                        }

                      />

                      <Form.Text className="text-muted">

                        Enter a

                        15-character

                        Indian GSTIN.

                        PAN, State Code

                        and State will

                        be filled

                        automatically.

                      </Form.Text>

                      <Form.Control.Feedback type="invalid">

                        Please enter a

                        valid GSTIN with

                        a supported

                        State Code.

                      </Form.Control.Feedback>

                    </Col>

                    <Col md={6}>

                      <Form.Label>

                        PAN

                      </Form.Label>

                      <Form.Control

                        value={

                          form.pan ||

                          ''

                        }

                        placeholder="Auto-filled from GSTIN"

                        readOnly

                        disabled

                      />

                      <Form.Text className="text-muted">

                        Automatically

                        derived from

                        characters 3–12

                        of GSTIN.

                      </Form.Text>

                    </Col>

                    <Col md={4}>

                      <Form.Label>

                        GST State Code

                      </Form.Label>

                      <Form.Control

                        value={

                          form.stateCode ||

                          ''

                        }

                        placeholder="Auto"

                        readOnly

                        disabled

                      />

                    </Col>

                    <Col md={8}>

                      <Form.Label>

                        GST State

                      </Form.Label>

                      <Form.Control

                        value={

                          form.state ||

                          ''

                        }

                        placeholder="Auto-filled from GSTIN"

                        readOnly

                        disabled

                      />

                    </Col>

                  </Row>

                </div>

                <hr />

                {/* =========================================

                    ADDRESS

                ========================================= */}

                <div className="my-4">

                  <h6 className="fw-semibold mb-3">

                    Address

                  </h6>

                  <Row className="g-3">

                    <Col md={12}>

                      <Form.Label>

                        Billing Address

                        *

                      </Form.Label>

                      <Form.Control

                        as="textarea"

                        rows={2}

                        required

                        maxLength={

                          1000

                        }

                        value={

                          form.billingAddress ||

                          ''

                        }

                        placeholder="Enter complete billing address"

                        onChange={(

                          e

                        ) =>

                          setForm(

                            (

                              prev

                            ) => ({

                              ...prev,

                              billingAddress:

                                e

                                  .target

                                  .value

                            })

                          )

                        }

                      />

                    </Col>

                    <Col md={12}>

                      <Form.Label>

                        Shipping Address

                      </Form.Label>

                      <Form.Control

                        as="textarea"

                        rows={2}

                        maxLength={

                          1000

                        }

                        value={

                          form.shippingAddress ||

                          ''

                        }

                        placeholder="Enter shipping / delivery address if different"

                        onChange={(

                          e

                        ) =>

                          setForm(

                            (

                              prev

                            ) => ({

                              ...prev,

                              shippingAddress:

                                e

                                  .target

                                  .value

                            })

                          )

                        }

                      />

                    </Col>

                  </Row>

                </div>

                <hr />

                {/* =========================================

                    PAYMENT TERMS

                ========================================= */}

                <div className="my-4">

                  <h6 className="fw-semibold mb-3">

                    Payment Terms

                  </h6>

                  <Row className="g-3">

                    <Col md={6}>

                      <Form.Label>

                        Payment Term

                        Basis *

                      </Form.Label>

                      <Form.Select

                        required

                        value={

                          form.paymentTermBasis ||

                          'INVOICE_DATE'

                        }

                        onChange={(

                          e

                        ) =>

                          setForm(

                            (

                              prev

                            ) => ({

                              ...prev,

                              paymentTermBasis:

                                e

                                  .target

                                  .value

                            })

                          )

                        }

                      >

                        <option value="INVOICE_DATE">

                          From Invoice

                          Date

                        </option>

                        <option value="GR_DATE">

                          From GR Date

                        </option>

                        <option value="FIXED_DUE_DATE">

                          Fixed Due Date

                        </option>

                        <option value="ADVANCE">Advance</option>

                          <option value="OTHER">

                          Other

                        </option>

                      </Form.Select>

                    </Col>

                    <Col md={6}>

                      <Form.Label>

                        Credit /

                        Payment Days *

                      </Form.Label>

                      <Form.Control

                        type="number"

                        min="0"

                        max="3650"

                        required

                        value={

                          form.paymentTermsDays ??

                          0

                        }

                        onChange={(

                          e

                        ) =>

                          setForm(

                            (

                              prev

                            ) => ({

                              ...prev,

                              paymentTermsDays:

                                Number(

                                  e

                                    .target

                                    .value

                                )

                            })

                          )

                        }

                      />

                    </Col>

                    <Col md={12}>

                      <Form.Label>

                        Payment Terms

                        Remarks

                      </Form.Label>

                      <Form.Control

                        as="textarea"

                        rows={2}

                        maxLength={

                          500

                        }

                        value={

                          form.paymentTermsRemarks ||

                          ''

                        }

                        placeholder="Example: Immediate after Job Completion"

                        onChange={(

                          e

                        ) =>

                          setForm(

                            (

                              prev

                            ) => ({

                              ...prev,

                              paymentTermsRemarks:

                                e

                                  .target

                                  .value

                            })

                          )

                        }

                      />

                    </Col>

                  </Row>

                </div>

                <hr />

                {/* =========================================

                    OTHER

                ========================================= */}

                <div className="mt-4">

                  <h6 className="fw-semibold mb-3">

                    Other

                    Information

                  </h6>

                  <Row className="g-3">

                    <Col md={12}>

                      <Form.Label>

                        Remarks

                      </Form.Label>

                      <Form.Control

                        as="textarea"

                        rows={2}

                        maxLength={

                          1000

                        }

                        value={

                          form.remarks ||

                          ''

                        }

                        placeholder="Optional internal remarks"

                        onChange={(

                          e

                        ) =>

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

                    <Col md={12}>

                      <Form.Check

                        type="switch"

                        id="customer-active-switch"

                        label="Customer Active"

                        checked={

                          form.isActive ??

                          true

                        }

                        onChange={(

                          e

                        ) =>

                          setForm(

                            (

                              prev

                            ) => ({

                              ...prev,

                              isActive:

                                e

                                  .target

                                  .checked

                            })

                          )

                        }

                      />

                    </Col>

                  </Row>

                </div>

              </>

            ) : (

              /* ===========================================

                 ITEM FORM

              =========================================== */

              <Row className="g-3">

                <Col md={6}>

                  <Form.Label>

                    Item Code *

                  </Form.Label>

                  <Form.Control

                    required

                    value={

                      form.itemCode ||

                      ''

                    }

                    onChange={(e) =>

                      setForm(

                        (

                          prev

                        ) => ({

                          ...prev,

                          itemCode:

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

                    Material Code

                  </Form.Label>

                  <Form.Control

                    value={

                      form.materialCode ||

                      ''

                    }

                    placeholder="Enter material code"

                    onChange={(e) =>

                      setForm(

                        (prev) => ({

                          ...prev,

                          materialCode:

                            e.target.value.toUpperCase()

                        })

                      )

                    }

                  />

                </Col>

                <Col md={6}>

                  <Form.Label>

                    HSN / SAC *

                  </Form.Label>

                  <Form.Control

                    required

                    value={

                      form.hsnSac ||

                      ''

                    }

                    onChange={(e) =>

                      setForm(

                        (

                          prev

                        ) => ({

                          ...prev,

                          hsnSac:

                            e

                              .target

                              .value

                        })

                      )

                    }

                  />

                </Col>

                <Col md={12}>

                  <Form.Label>

                    Description *

                  </Form.Label>

                  <Form.Control

                    required

                    value={

                      form.description ||

                      ''

                    }

                    onChange={(e) =>

                      setForm(

                        (

                          prev

                        ) => ({

                          ...prev,

                          description:

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

                    Type

                  </Form.Label>

                  <Form.Select

                    value={

                      form.type ||

                      'SERVICE'

                    }

                    onChange={(e) =>

                      setForm(

                        (

                          prev

                        ) => ({

                          ...prev,

                          type:

                            e

                              .target

                              .value

                        })

                      )

                    }

                  >

                    <option value="ITEM">

                      ITEM

                    </option>

                    <option value="SERVICE">

                      SERVICE

                    </option>

                  </Form.Select>

                </Col>

                <Col md={4}>

                  <Form.Label>

                    Default Rate

                  </Form.Label>

                  <Form.Control

                    type="number"

                    min="0"

                    step="0.01"

                    value={

                      form.defaultRate ??

                      0

                    }

                    onChange={(e) =>

                      setForm(

                        (

                          prev

                        ) => ({

                          ...prev,

                          defaultRate:

                            Number(

                              e

                                .target

                                .value

                            )

                        })

                      )

                    }

                  />

                </Col>

                <Col md={4}>

                  <Form.Label>

                    GST %

                  </Form.Label>

                  <Form.Control

                    type="number"

                    min="0"

                    max="100"

                    step="0.01"

                    value={

                      form.defaultTaxPercent ??

                      0

                    }

                    onChange={(e) =>

                      setForm(

                        (

                          prev

                        ) => ({

                          ...prev,

                          defaultTaxPercent:

                            Number(

                              e

                                .target

                                .value

                            )

                        })

                      )

                    }

                  />

                </Col>

              </Row>

            )}

          </Modal.Body>

         <Modal.Footer>

  <Button

    variant="light"

    onClick={closeModal}

    disabled={saving}

  >

    Cancel

  </Button>

  <Button

    className="primary-btn"

    type="submit"

    disabled={saving}

  >

    {saving

      ? 'Saving...'

      : editingId

        ? 'Update Customer'

        : 'Save'}

  </Button>

</Modal.Footer>

        </Form>

      </Modal>

    </>

  );

}