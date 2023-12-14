import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { CssBaseline } from '@mui/material';
import Routing from './routes/Routing';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';

const App = () => {
  return (
    <BrowserRouter>
      <CssBaseline />
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Routing />
      </LocalizationProvider>
    </BrowserRouter>
  );
};

export default App;
