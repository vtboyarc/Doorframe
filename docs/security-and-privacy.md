# Security and Privacy

Doorframe runs locally by default and does not send imported project data to any external service. Do not use Doorframe with classified, controlled, proprietary, or sensitive data unless your organization has approved that use in your environment.

## Direct Boundaries

- Doorframe does not decide whether an environment is approved for classified, controlled, proprietary, export-controlled, or sensitive data.
- Doorframe is not a compliance certification.
- Doorframe does not make a system FedRAMP, IL4, IL5, CMMC, NIST, or export-control compliant.
- Doorframe does not make a program review-ready by itself.
- Doorframe is not a replacement for official requirements, test, security, or compliance systems.

Organizations are responsible for approving their own use of Doorframe in their own environment.

## Data Handling

Doorframe:

- Stores project data locally.
- Uses SQLite for the local web app.
- Does not add telemetry.
- Does not require cloud accounts.
- Does not call external APIs by default.
- Does not require AI.

## Sensitive Data

Do not import controlled, sensitive, proprietary, export-controlled, or classified data into an unapproved environment. Running Doorframe on a personal laptop, public cloud instance, or unmanaged container does not make that environment approved.

## Demo Data

The fake-data demo is safe to share because it contains fictional requirements, fictional Jira issue keys, fictional test names, and no real program markings.
