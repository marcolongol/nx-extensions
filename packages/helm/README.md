# `@nx-extensions/helm`

First class support for Helm charts in Nx.

The Nx Plugin for Helm provides a set of executors, generators, and utilities to help you manage Helm charts in your Nx workspace.

## Features

- [x] Generate Helm charts for your applications
- [ ] Lint Helm charts
- [ ] Test Helm charts
- [ ] Version Helm charts
- [x] Package Helm charts
- [x] Publish Helm charts

## Getting Started

### Install the Nx Plugin for Helm

To get started with the Nx Plugin for Helm, run the following command:

```bash
npm install --save-dev @nx-extensions/helm
```

### Add a Helm chart to your project

To get started with the Nx Plugin for Helm, run the following command:

```bash
nx g @nx-extensions/helm:chart --name=my-chart --project=my-app
```

This will generate a new Helm chart for your project under the `chart` directory and configure the helm target in your project `project.json` file.

### Build and package your Helm chart

To build and package your Helm chart, run the following command:

```bash
nx run my-app:helm
```

This will build and package your Helm chart and output the packaged chart in the `charts` directory under the workspace root.
