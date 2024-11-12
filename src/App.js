// src/App.js

import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Container,
  Snackbar,
  Alert,
  createTheme,
  ThemeProvider,
  CssBaseline,
  Tooltip,
  Switch as MuiSwitch,
  AppBar,
  Toolbar,
  Button,
} from "@mui/material";
import { BrowserRouter as Router, Route, Routes, Link } from "react-router-dom";
import "./App.css";

// Importing Components
import Dashboard from "./components/Dashboard";
import FaultsPage from "./components/FaultsPage";
import SystemStatus from "./components/SystemStatus";
import LEDControls from "./components/LEDControls";
import Notifications from "./components/Notifications";

// Import BACKEND_URL from config
import BACKEND_URL from "./config";

function App() {
  const [status, setStatus] = useState(null);
  const [responseMessage, setResponseMessage] = useState("");
  const [responseSeverity, setResponseSeverity] = useState("success");
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [ledControls, setLedControls] = useState({
    PIR: false,
    IR: false,
    TCS: false,
    LED1: false,
    LED2: false,
    LED3: false,
  });
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [isBackendDown, setIsBackendDown] = useState(false);

  const theme = createTheme({
    palette: {
      mode: darkMode ? "dark" : "light",
      primary: {
        main: "#1976d2",
      },
      secondary: {
        main: "#dc004e",
      },
    },
  });

  // Fetch status from the backend on initial load and periodically
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${BACKEND_URL}/status`);
      console.log("Backend response data:", response.data); // Log the response data
      setStatus(response.data);
      setIsBackendDown(false); // Backend is up

      // Update LED controls based on status data
      setLedControls({
        PIR: response.data.current_duty?.PIR > 0,
        IR: response.data.current_duty?.IR > 0,
        TCS: response.data.current_duty?.TCS > 0,
        LED1: response.data.current_duty?.LED1 > 0,
        LED2: response.data.LED2_state, // Use 'LED2_state' from backend response
        LED3: response.data.current_duty?.LED3 > 0,
      });
    } catch (error) {
      console.error("Error fetching status:", error);
      setResponseMessage("Failed to fetch status.");
      setResponseSeverity("error");
      setOpenSnackbar(true);
      setIsBackendDown(true); // Backend is down
      setStatus(null); // Clear previous status
      // Set LED2 to off if backend is down
      setLedControls((prev) => ({
        ...prev,
        LED2: false,
      }));
    } finally {
      setLoading(false);
    }
  };

  const toggleLed = async (ledName) => {
    const newState = !ledControls[ledName];
    setLedControls((prev) => ({
      ...prev,
      [ledName]: newState,
    }));

    try {
      await axios.post(`${BACKEND_URL}/set_led`, {
        led: ledName, // Send ledName directly
        state: newState,
      });
      setResponseMessage(`${ledName} LED turned ${newState ? "ON" : "OFF"}.`);
      setResponseSeverity("success");
      setOpenSnackbar(true);
    } catch (error) {
      console.error(
        `Error toggling ${ledName} LED:`,
        error.response?.data || error.message
      );
      setResponseMessage(`Failed to toggle ${ledName} LED.`);
      setResponseSeverity("error");
      setOpenSnackbar(true);
    }
  };

  const handleCloseSnackbar = () => {
    setOpenSnackbar(false);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <AppBar position="static">
          <Toolbar>
            <Button color="inherit" component={Link} to="/">
              Dashboard
            </Button>
            <Button color="inherit" component={Link} to="/faults">
              Faults
            </Button>
            <Tooltip title="Toggle dark/light mode">
              <MuiSwitch
                checked={darkMode}
                onChange={() => setDarkMode(!darkMode)}
                color="default"
                inputProps={{ "aria-label": "toggle dark mode" }}
                style={{ marginLeft: "auto" }}
              />
            </Tooltip>
          </Toolbar>
        </AppBar>

        <div className="App">
          <Container maxWidth="lg" className="main-container">
            {/* Notifications component to show real-time fault alerts */}
            <Notifications status={status} isBackendDown={isBackendDown} />

            <Routes>
              <Route
                path="/"
                element={
                  <>
                    <Dashboard status={status} isBackendDown={isBackendDown} />
                    <SystemStatus
                      status={status}
                      loading={loading}
                      fetchStatus={fetchStatus}
                      isBackendDown={isBackendDown}
                    />
                    <LEDControls
                      ledControls={ledControls}
                      toggleLed={toggleLed}
                      faults={status?.faults}
                      isBackendDown={isBackendDown}
                    />
                  </>
                }
              />
              <Route
                path="/faults"
                element={
                  <FaultsPage status={status} isBackendDown={isBackendDown} />
                }
              />
            </Routes>
          </Container>
        </div>

        {/* Snackbar for user feedback on actions like toggling LEDs */}
        <Snackbar
          open={openSnackbar}
          autoHideDuration={6000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert
            onClose={handleCloseSnackbar}
            severity={responseSeverity}
            sx={{ width: "100%" }}
          >
            {responseMessage}
          </Alert>
        </Snackbar>
      </Router>
    </ThemeProvider>
  );
}

export default App;
