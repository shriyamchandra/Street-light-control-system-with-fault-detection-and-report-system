// src/hooks/useStatus.js

import { useState, useEffect } from "react";
import axios from "axios";

const BACKEND_URL = "http://192.168.177.178:8000"; // Replace with your backend URL

const useStatus = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isBackendDown, setIsBackendDown] = useState(false);

  const fetchStatus = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/status`);
      setStatus(response.data);
      setError(null);
      setIsBackendDown(false); // Backend is up
    } catch (err) {
      console.error("Error fetching status:", err);
      setError("Failed to fetch status.");
      setIsBackendDown(true); // Backend is down
      setStatus(null); // Clear previous status
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus(); // Initial fetch
    const interval = setInterval(fetchStatus, 5000); // Poll every 5 seconds
    return () => clearInterval(interval); // Cleanup on unmount
  }, []);

  return { status, loading, error, isBackendDown, fetchStatus };
};

export default useStatus;
