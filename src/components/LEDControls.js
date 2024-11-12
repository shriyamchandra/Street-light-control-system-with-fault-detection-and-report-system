// src/components/LEDControls.js

import React from "react";
import { Card, CardContent, Typography, Grid } from "@mui/material";
import LEDIndicator from "./LEDIndicator";
import PropTypes from "prop-types";

function LEDControls({ ledControls, toggleLed, faults, isBackendDown }) {
  return (
    <Card style={{ marginBottom: "20px" }}>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          LED Controls
        </Typography>
        <Grid container spacing={3} justifyContent="center">
          {Object.keys(ledControls).map((led) => (
            <Grid item xs={12} sm={6} md={4} key={led}>
              <LEDIndicator
                ledName={led}
                isOn={ledControls[led]}
                toggleLed={toggleLed}
                isFaulty={faults ? faults[`${led}_Failure`] : false}
              />
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
}

LEDControls.propTypes = {
  ledControls: PropTypes.object.isRequired,
  toggleLed: PropTypes.func.isRequired,
  faults: PropTypes.object,
  isBackendDown: PropTypes.bool.isRequired,
};

export default LEDControls;
