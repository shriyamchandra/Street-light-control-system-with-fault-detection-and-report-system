// src/components/FaultModeControl.js

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Grid,
  Snackbar,
  Alert,
} from "@mui/material";
import axios from "axios";
import BACKEND_URL from "../config"; // Import BACKEND_URL

// Define fault modes as per backend
const FAULT_MODES = {
  '1': 'Normal Operation',
  '2': 'Simulate PIR Sensor Failure',
  '3': 'Simulate IR Sensor Failure',
  '4': 'Simulate TCS Sensor Failure',
  '5': 'Simulate I2C Communication Failure',
  '6': 'Simulate GPIO Output Failure',
  '7': 'Simulate Power Issues',
  '8': 'Simulate Delayed Response',
  '9': 'Simulate Sensor Cross-Talk',
  '10': 'Simulate LED1 Failure',
  '11': 'Simulate LED2 Failure',
  '12': 'Simulate LED3 Failure',
  // Add more fault modes as needed
};

function FaultModeControl() {
  const [selectedMode, setSelectedMode] = useState('1'); // Default to Normal Operation
  const [loading, setLoading] = useState(false);
  const [responseMessage, setResponseMessage] = useState("");
  const [responseSeverity, setResponseSeverity] = useState("success");
  const [openSnackbar, setOpenSnackbar] = useState(false);

  // Optional: Fetch current fault mode on component mount
  useEffect(() => {
    const fetchCurrentMode = async () => {
      try {
        const response = await axios.get(`${BACKEND_URL}/status`);
        const currentFaultMode = response.data.fault_mode;
        const modeKey = Object.keys(FAULT_MODES).find(key => FAULT_MODES[key] === currentFaultMode);
        if (modeKey) {
          setSelectedMode(modeKey);
        }
      } catch (error) {
        console.error("Error fetching current fault mode:", error);
      }
    };

    fetchCurrentMode();
  }, []);

  const handleSetFaultMode = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${BACKEND_URL}/set_fault_mode`, {
        mode: selectedMode,
      });
      setResponseMessage(response.data.message || "Fault mode set successfully.");
      setResponseSeverity("success");
    } catch (error) {
      console.error("Error setting fault mode:", error);
      setResponseMessage(
        error.response?.data?.error || "Failed to set fault mode."
      );
      setResponseSeverity("error");
    } finally {
      setLoading(false);
      setOpenSnackbar(true);
    }
  };

  const handleCloseSnackbar = () => {
    setOpenSnackbar(false);
  };

  return (
    <>
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Simulation-Based Faults
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={8}>
              <FormControl fullWidth variant="outlined">
                <InputLabel id="fault-mode-label">Select Fault Mode</InputLabel>
                <Select
                  labelId="fault-mode-label"
                  value={selectedMode}
                  onChange={(e) => setSelectedMode(e.target.value)}
                  label="Select Fault Mode"
                >
                  {Object.entries(FAULT_MODES).map(([key, value]) => (
                    <MenuItem value={key} key={key}>
                      {value}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleSetFaultMode}
                fullWidth
                disabled={loading} // Removed 'selectedMode === '1'' to allow setting Normal Operation
              >
                {loading ? "Setting..." : "Set Fault Mode"}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Snackbar for feedback */}
      <Snackbar
        open={openSnackbar}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={responseSeverity}
          sx={{ width: "100%" }}
        >
          {responseMessage}
        </Alert>
      </Snackbar>
    </>
  );
}

export default FaultModeControl;
