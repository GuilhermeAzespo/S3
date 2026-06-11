import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Buckets from './pages/Buckets';
import BucketExplorer from './pages/BucketExplorer';
import Layout from './components/Layout';

function App() {
  const isAuthenticated = !!localStorage.getItem('token');

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Protected Routes */}
        <Route path="/" element={isAuthenticated ? <Layout /> : <Navigate to="/login" />}>
          <Route index element={<Dashboard />} />
          <Route path="buckets" element={<Buckets />} />
          <Route path="buckets/:bucketId" element={<BucketExplorer />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}


export default App;
