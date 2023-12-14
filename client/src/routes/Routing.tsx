import { Routes, Route } from 'react-router-dom';
import Home from '@/pages/Home/Home';
import PatientProfile from '@/pages/PatientProfile/PatientProfile';

const Routing = () => {
  return (
    <Routes>
      <Route path="*" element={<Home />} />
      <Route path="patient/:patientId" element={<PatientProfile />} />
    </Routes>
  );
};

export default Routing;
