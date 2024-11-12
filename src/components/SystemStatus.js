// src/components/SystemStatus.js

import React from "react";
import {
  Card,
  CardContent,
  Typography,
  Button,
  Tooltip,
  CircularProgress,
  Grid,
  Box,
  Chip,
} from "@mui/material";
import { Refresh } from "@mui/icons-material";
import PropTypes from "prop-types";

function SystemStatus({ status, loading, fetchStatus, isBackendDown }) {
  const faults = getFaults(status, isBackendDown);

  return (
    <Card style={{ marginBottom: "20px" }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h5">System Status</Typography>
          <Tooltip title="Refresh Status">
            <Button
              variant="contained"
              color="primary"
              onClick={fetchStatus}
              startIcon={<Refresh />}
            >
              Refresh
            </Button>
          </Tooltip>
        </Box>
        {loading ? (
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            style={{ marginTop: "20px" }}
          >
            <CircularProgress />
          </Box>
        ) : isBackendDown ? (
          <Typography
            variant="h6"
            color="error"
            style={{ marginTop: "20px" }}
          >
            Backend server is not responding.
          </Typography>
        ) : status ? (
          <Grid container spacing={3} style={{ marginTop: "20px" }}>
            <Grid item xs={12} sm={6}>
              <Typography variant="h6">Current Duty Cycles:</Typography>
              {status.current_duty &&
                Object.keys(status.current_duty).map((led) => (
                  <Typography key={led} variant="body1">
                    <strong>{led} LED:</strong> {status.current_duty[led]}%
                  </Typography>
                ))}
              {status.LED2_state !== undefined && (
                <Typography variant="body1">
                  <strong>LED2:</strong> {status.LED2_state ? "On" : "Off"}
                </Typography>
              )}
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="h6">Active Faults:</Typography>
              {faults.length > 0 ? (
                faults.map((fault, index) => (
                  <Typography
                    key={index}
                    variant="body1"
                    color="error"
                  >
                    <strong>{fault.name}:</strong> {fault.description}{" "}
                    <Chip
                      label={fault.type}
                      color="error"
                      size="small"
                      style={{ marginLeft: "5px" }}
                    />
                  </Typography>
                ))
              ) : (
                <Typography variant="body1" color="text.secondary">
                  No active faults detected.
                </Typography>
              )}
            </Grid>
          </Grid>
        ) : (
          <Typography
            variant="body1"
            color="text.secondary"
            style={{ marginTop: "20px" }}
          >
            No status available. Click "Refresh" to load.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

SystemStatus.propTypes = {
  status: PropTypes.shape({
    current_duty: PropTypes.object,
    faults: PropTypes.object,
    LED2_state: PropTypes.bool,
  }),
  loading: PropTypes.bool.isRequired,
  fetchStatus: PropTypes.func.isRequired,
  isBackendDown: PropTypes.bool.isRequired,
};

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

export default SystemStatus;
