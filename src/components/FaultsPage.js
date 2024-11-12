// src/components/FaultsPage.js

import React, { useEffect, useState, useRef } from "react";
import { Card, CardContent, Typography, Grid, Button, Chip, Divider } from "@mui/material";
import { Error } from "@mui/icons-material";

function FaultsPage({ status, isBackendDown }) {
  const [faultHistory, setFaultHistory] = useState([]);
  const previousFaultsRef = useRef([]);

  // Load fault history from localStorage on component mount
  useEffect(() => {
    const storedHistory = localStorage.getItem("faultHistory");
    if (storedHistory) {
      setFaultHistory(JSON.parse(storedHistory));
    }
  }, []);

  // Effect to detect and log new faults
  useEffect(() => {
    const currentFaults = getFaults(status, isBackendDown);
    const previousFaults = previousFaultsRef.current;

    // Identify new faults
    const newFaults = currentFaults.filter(
      (fault) =>
        !previousFaults.some(
          (pf) => pf.name === fault.name && pf.type === fault.type && pf.timestamp === fault.timestamp
        )
    );

    if (newFaults.length > 0) {
      const timestamp = new Date().toLocaleString();
      const newEntries = newFaults.map((fault) => ({
        name: fault.name,
        description: fault.description,
        type: fault.type,
        timestamp,
      }));

      // Append new faults to the existing history
      setFaultHistory((prevHistory) => {
        const updatedHistory = [...prevHistory, ...newEntries];
        // Persist to localStorage
        localStorage.setItem("faultHistory", JSON.stringify(updatedHistory));
        return updatedHistory;
      });
    }

    // Update previous faults reference for next comparison
    previousFaultsRef.current = currentFaults;
  }, [status, isBackendDown]);

  // Function to clear fault history
  const clearFaultHistory = () => {
    setFaultHistory([]);
    localStorage.removeItem("faultHistory");
  };

  return (
    <div style={{ padding: "20px" }}>
      <Typography variant="h4" gutterBottom>
        System Faults
      </Typography>

      {/* Current Active Faults */}
      <Typography variant="h5" gutterBottom>
        Current Active Faults
      </Typography>
      {getFaults(status, isBackendDown).length > 0 ? (
        <Grid container spacing={3}>
          {getFaults(status, isBackendDown).map((fault, index) => (
            <Grid item xs={12} sm={6} md={4} key={`current-${index}`}>
              <Card variant="outlined" style={{ borderColor: "red" }}>
                <CardContent style={{ textAlign: "center" }}>
                  <Error fontSize="large" color="error" />
                  <Typography variant="h6" style={{ marginTop: "10px" }}>
                    {fault.name} Fault
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {fault.description}
                  </Typography>
                  <Chip
                    label={fault.type}
                    color="error"
                    size="small"
                    style={{ marginTop: "5px" }}
                  />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Typography
          variant="h6"
          color="text.secondary"
          style={{ marginTop: "20px" }}
        >
          No faults detected.
        </Typography>
      )}

      <Divider style={{ margin: "40px 0" }} />

      {/* Fault History */}
      <Typography variant="h5" gutterBottom>
        Fault History
      </Typography>
      {faultHistory.length > 0 ? (
        <>
          <Grid container spacing={3}>
            {faultHistory
              .slice()
              .reverse()
              .map((fault, index) => (
                <Grid item xs={12} sm={6} md={4} key={`history-${index}`}>
                  <Card variant="outlined" style={{ borderColor: "red" }}>
                    <CardContent style={{ textAlign: "center" }}>
                      <Error fontSize="large" color="error" />
                      <Typography variant="h6" style={{ marginTop: "10px" }}>
                        {fault.name} Fault
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {fault.description}
                      </Typography>
                      <Chip
                        label={fault.type}
                        color="error"
                        size="small"
                        style={{ marginTop: "5px" }}
                      />
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        style={{ display: "block", marginTop: "10px" }}
                      >
                        Occurred on: {fault.timestamp}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
          </Grid>
          <Button
            variant="contained"
            color="secondary"
            onClick={clearFaultHistory}
            style={{ marginTop: "20px" }}
          >
            Clear Fault History
          </Button>
        </>
      ) : (
        <Typography
          variant="h6"
          color="text.secondary"
          style={{ marginTop: "20px" }}
        >
          No fault history available.
        </Typography>
      )}
    </div>
  );
}

function getFaults(status, isBackendDown) {
  let faults = [];

  if (isBackendDown) {
    faults.push({
      name: "Backend Server",
      description: "Backend server is not responding.",
      type: "Connectivity",
    });
  }

  if (status && status.faults) {
    const faultEntries = status.faults;

    Object.keys(faultEntries).forEach((key) => {
      if (faultEntries[key]) {
        let faultName = "";
        let faultDescription = "";
        let faultType = "Actual"; // Default to Actual

        switch (key) {
          case "PIR_Sensor_Failure":
            faultName = "PIR Sensor";
            faultDescription = "PIR Sensor Failure Detected.";
            break;
          case "IR_Sensor_Failure":
            faultName = "IR Sensor";
            faultDescription = "IR Sensor Failure Detected.";
            break;
          case "TCS_Sensor_Failure":
            faultName = "TCS Sensor";
            faultDescription = "TCS Sensor Failure Detected.";
            break;
          case "I2C_Communication_Failure":
            faultName = "I2C Communication";
            faultDescription = "I2C Communication Failure Detected.";
            break;
          case "Sensor_CrossTalk":
            faultName = "Sensor Cross-Talk";
            faultDescription = "Sensor Cross-Talk Detected.";
            break;
          case "PIR_LED_Failure":
            faultName = "PIR LED";
            faultDescription = "PIR LED Failure Detected.";
            break;
          case "IR_LED_Failure":
            faultName = "IR LED";
            faultDescription = "IR LED Failure Detected.";
            break;
          case "TCS_LED_Failure":
            faultName = "TCS LED";
            faultDescription = "TCS LED Failure Detected.";
            break;
          case "LED1_Failure":
          case "LED2_Failure":
          case "LED3_Failure":
            faultName = key.replace("_Failure", "");
            faultDescription = `${faultName} Failure Detected.`;
            break;
          default:
            faultName = key;
            faultDescription = "Unknown Fault Detected.";
        }

        faults.push({
          name: faultName,
          description: faultDescription,
          type: faultType,
        });
      }
    });
  }

  return faults;
}

export default FaultsPage;
