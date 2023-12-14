import React, { useEffect, useState } from 'react';
import { Card, CardContent, Typography, Grid, Button, Box, Avatar } from '@mui/material';

import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';

interface Patient {
  firstName: string;
  lastName: string;
  birthday: Date;
  description: string;
  primaryDoctor: string;
  imageUrl?: string;
}

const PatientProfile = () => {
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { patientId } = useParams();
  const [patientData, setPatientData] = useState<Patient | null>(null);
  const backendUrl = import.meta.env.VITE_APP_BACKEND_URL;

  const formatDate = (date: Date | undefined): string => {
    if (!date) return 'Loading';
    return new Date(date).toLocaleDateString();
  };

  useEffect(() => {
    axios
      .get(`${backendUrl}/patients/${patientId}`)
      .then((response) => {
        const data: Patient = response.data;
        setPatientData(data);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error('Error fetching patient data:', error);
      });
  }, [patientId]);

  return (
    <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
      <Card sx={{ maxWidth: 600 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="h5" gutterBottom>
                Patient Profile
              </Typography>
            </Grid>
            <Grid item xs={12}>
              {patientData?.imageUrl && (
                <Avatar
                  alt={`${patientData.firstName} ${patientData.lastName}`}
                  src={patientData.imageUrl}
                  sx={{ width: 100, height: 100, margin: '0 auto', border: '2px solid #007bff' }}
                />
              )}
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body1">
                <strong>First Name:</strong> {isLoading ? 'Loading' : patientData?.firstName}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body1">
                <strong>Last Name:</strong> {isLoading ? 'Loading' : patientData?.lastName}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body1">
                <strong>Birthday:</strong> {isLoading ? 'Loading' : formatDate(patientData?.birthday)}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body1">
                <strong>Primary Doctor:</strong> {isLoading ? 'Loading' : patientData?.primaryDoctor}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body1">
                <strong>Description:</strong> {isLoading ? 'Loading' : patientData?.description}
              </Typography>
            </Grid>
          </Grid>
          <Box display="flex" justifyContent="center" marginTop={2}>
            <Button variant="contained" color="primary" onClick={() => navigate('/')}>
              Back
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default PatientProfile;
