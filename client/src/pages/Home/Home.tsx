import { useState, useEffect, FormEvent } from 'react';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import {
  Container,
  Drawer,
  TextField,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';

import axios from 'axios';

import { GridColDef, DataGrid, GridActionsCellItem, GridToolbar, GridRowParams, GridRowId } from '@mui/x-data-grid';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import { NavLink } from 'react-router-dom';
import EditIcon from '@mui/icons-material/Edit';
import dayjs, { Dayjs } from 'dayjs';

interface Patient {
  id?: string;
  firstName: string;
  lastName: string;
  birthday: Date;
  imageUrl?: string;
  identifier?: string;
  description: string;
  primaryDoctor: string;
  image?: File | undefined | Blob;
}

const Home = () => {
  const initialSelectedRow: Patient = {
    firstName: '',
    lastName: '',
    birthday: new Date(),
    description: '',
    primaryDoctor: '',
  };
  const [patients, setPatients] = useState<Patient[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rowToDelete, setRowToDelete] = useState<GridRowId | null>(null);

  const [mode, setMode] = useState<string>();

  const backendUrl = import.meta.env.VITE_APP_BACKEND_URL;

  const [selectedRow, setSelectedRow] = useState<Patient>(initialSelectedRow);

  const handleInputChange = (field: string, value: string | Dayjs | null) => {
    setSelectedRow((prevRow: Patient | null) => ({
      ...(prevRow as Patient),
      [field]: value || '',
    }));
  };

  const fetchPatients = async () => {
    try {
      const response = await axios.get(`${backendUrl}/patients`, {
        headers: {
          Accept: 'application/json',
        },
      });
      const data = response.data.map((patient: Patient) => ({
        ...patient,
        birthday: new Date(patient.birthday),
      }));
      setPatients(data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const deletePatient = async () => {
    try {
      await axios.delete(`${backendUrl}/patients/${rowToDelete}`);
      fetchPatients();
      console.log('Patient deleted successfully');
      setDeleteDialogOpen(false);
    } catch (error) {
      console.error('Failed to delete patient:', error);
      setDeleteDialogOpen(true);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, params: GridRowParams) => {
    setRowToDelete(params.id as GridRowId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    deletePatient();
  };

  const addRecord = async (patientData: Patient | null) => {
    if (!patientData) {
      return;
    }
    try {
      // create form
      const formData = new FormData();
      console.log('patientData.birthday.toISOString(): ', patientData.birthday.toISOString());
      formData.append('firstName', patientData.firstName);
      formData.append('lastName', patientData.lastName);
      formData.append('birthday', patientData.birthday.toISOString());
      formData.append('description', patientData.description);
      formData.append('primaryDoctor', patientData.primaryDoctor);
      if (patientData.image) {
        formData.append('image', patientData.image);
      }

      const response = await axios.post(`${backendUrl}/patients`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      const result = response.data;
      await fetchPatients();
      console.log('Patient added successfully:', result);
    } catch (error) {
      console.error('Failed to add patient:', error);
    }
  };

  const editRecord = async (patientData: Patient | null) => {
    if (!patientData || !patientData.id) {
      return;
    }
    const patientId = patientData.id;
    console.log('Editing patient with ID:', patientId, 'with data:', patientData);
    const formData = new FormData();
    formData.append('firstName', patientData.firstName);
    formData.append('lastName', patientData.lastName);
    formData.append('birthday', patientData.birthday.toISOString());
    formData.append('description', patientData.description);
    formData.append('primaryDoctor', patientData.primaryDoctor);
    if (patientData.image) {
      formData.append('image', patientData.image);
    }
    try {
      const response = await axios.put(`${backendUrl}/patients/${patientId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      const result = response.data;
      await fetchPatients();
      console.log('Patient edited successfully:', result);
    } catch (error) {
      console.error('Failed to edit patient:', error);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    mode === 'Edit' ? editRecord(selectedRow) : addRecord(selectedRow);
    setDrawerOpen(false);
  };

  const handleAdd = () => {
    setSelectedRow({
      firstName: '',
      lastName: '',
      birthday: new Date(),
      description: '',
      primaryDoctor: '',
    });
    setDrawerOpen(true);
    setMode('Add');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      setSelectedRow((prevSelectedRow) => ({
        ...prevSelectedRow,
        image: file,
      }));
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'firstName',
      headerName: 'First Name',
      width: 180,
      editable: false,
      renderCell: (params) => <NavLink to={`/patient/${params.id}`}>{params.value}</NavLink>,
    },
    { field: 'lastName', headerName: 'Last Name', width: 180, editable: false },
    { field: 'birthday', type: 'date', headerName: 'Birthday', width: 180, editable: false },
    { field: 'description', headerName: 'Description', width: 180, editable: false },
    { field: 'primaryDoctor', headerName: 'Primary Doctor', width: 180, editable: false },
    // add actions button
    {
      field: 'actions',
      type: 'actions',
      width: 100,
      getActions: (params) => [
        <GridActionsCellItem
          icon={<DeleteIcon />}
          key={`delete-${params.id}`}
          label="Delete"
          onClick={(e) => handleDeleteClick(e, params)}
        />,
        <GridActionsCellItem
          icon={<EditIcon />}
          key={`info-${params.id}`}
          label="Info"
          onClick={() => {
            setSelectedRow(params.row);
            setDrawerOpen(true);
            setMode('Edit');
          }}
        />,
      ],
    },
  ];

  return (
    <Container sx={{ py: 2, position: 'relative' }}>
      <h1>Patient Records</h1>
      <Button variant="contained" color="primary" onClick={handleAdd} style={{ marginBottom: '20px' }}>
        Add Record
      </Button>
      <DataGrid
        rows={patients}
        columns={columns}
        autoHeight
        disableDensitySelector
        slots={{
          toolbar: GridToolbar,
        }}
        slotProps={{
          toolbar: {
            showQuickFilter: true,
          },
        }}
      />
      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <form onSubmit={handleSubmit} style={{ width: '400px', padding: '20px' }}>
          <h1>{mode} Record</h1>
          <TextField
            label="First Name"
            value={selectedRow ? selectedRow.firstName : null}
            margin="normal"
            fullWidth
            required
            onChange={(event) => handleInputChange('firstName', event.target.value)}
          />
          <TextField
            label="Last Name"
            value={selectedRow ? selectedRow.lastName : null}
            margin="normal"
            fullWidth
            required
            onChange={(event) => handleInputChange('lastName', event.target.value)}
          />

          <DatePicker
            label="Birthday"
            defaultValue={selectedRow ? dayjs(selectedRow.birthday) : ''}
            onChange={(event) => handleInputChange('birthday', event)}
          />

          <TextField
            label="Description"
            value={selectedRow ? selectedRow.description : ''}
            margin="normal"
            fullWidth
            multiline
            required
            onChange={(event) => handleInputChange('description', event.target.value)}
          />
          <TextField
            label="Primary Doctor"
            value={selectedRow ? selectedRow.primaryDoctor : ''}
            margin="normal"
            fullWidth
            required
            onChange={(event) => handleInputChange('primaryDoctor', event.target.value)}
          />
          <div>
            <div
              style={{
                display: 'flex',
                gap: '8px',
                flexDirection: 'column',
              }}
            >
              <input
                accept="image/*"
                id="image-upload-input"
                type="file"
                required={mode === 'Edit' ? false : true}
                onChange={handleFileChange}
              />
              {selectedRow?.identifier && (
                <p>
                  {' '}
                  <strong>Uploaded File:</strong> {selectedRow?.identifier}.png
                </p>
              )}
            </div>
          </div>
          <Button type="submit" variant="contained" color="primary" style={{ marginTop: '20px' }}>
            Submit
          </Button>
        </form>
      </Drawer>
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>Are you sure you want to delete this row?</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} color="primary">
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} color="primary">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Home;
