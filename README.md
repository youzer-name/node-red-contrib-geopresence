# node-red-contrib-geopresence

A Node-RED node that detects whether a given set of coordinates is within a specified distance of a fixed location.

## Features

- One input, one output
- Configurable location and radius
- Dynamic coordinate checking from `msg`, `flow`, or `global`
- Customizable presence and absence messages
- Uses Haversine formula for accurate distance calculation

## Installation

```bash
npm install node-red-contrib-geopresence
