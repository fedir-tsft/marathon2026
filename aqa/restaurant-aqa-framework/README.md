# Restaurant AQA Framework

## Direction and approach

Track 1: Playwright + TypeScript, using a Page Object Model for UI interactions and direct API requests for setup/authorization checks. The target is the deployed application configured through environment variables.

## Local setup

1. Copy `.env.example` to `.env`.
2. Set valid frontend/API URLs and owner credentials. The UI tests create a new reservation and guest order for each run. The API authorization and empty-group tests still require their dedicated reservation/group IDs and guest credentials. Use dedicated test accounts and data only.
3. Install packages and the Chromium browser:

```powershell
npm ci
npx playwright install chromium
```

`.env` is ignored by Git. Never commit credentials or tokens.

## Run tests

```powershell
npx playwright test
npm run test:ui
npm run test:api
npm run test:level1
npm run test:level2
npm run test:level3
```

Playwright produces an HTML report at `playwright-report/index.html`, a JUnit report at `test-results/junit.xml`, and failure traces/screenshots/videos under `test-results`. View the HTML report with `npm run report`.

The UI tests sign in as the owner, choose a dynamically generated future date and available table for two people, create a reservation, retrieve its invite link, open it in a separate browser context, and submit two available guest dishes. One test verifies the owner’s group-order view; another submits the consolidated order. Each UI test cancels the reservation through the API in cleanup. The API authorization and empty-group tests still use dedicated IDs. This is not complete assignment coverage: Level 3 has no tests yet, and further Level 1/2 positive and negative scenarios must be added.

## Test data and behavior

Each UI test creates a fresh reservation and group, so the two UI flows do not reuse mutable group state. Reservation cancellation is performed during cleanup; the application does not provide hard-delete cleanup for reservations. The API tests use their own configured data and are not changed by the UI workflow.

The assignment leaves repeated submission and non-owner behavior unspecified. This scaffold currently accepts HTTP 400, 401, 403, or 404 for the non-owner attempt. Choose and document the application's actual expected behavior before treating that assertion as final.

## ReportPortal

Set all four `RP_ENDPOINT`, `RP_PROJECT`, `RP_API_KEY`, and `RP_LAUNCH` values in `.env` to send results to an existing ReportPortal server. `RP_API_KEY` is a secret and must never be committed. If no ReportPortal values are set, local HTML and JUnit reports still work. Partial ReportPortal configuration fails fast.

## AWS CodePipeline

The `aws-pipeline` Terraform configuration creates an AWS CodePipeline (GitHub CodeConnections source) and CodeBuild test stage. CodeBuild uploads Playwright HTML/JUnit/test artifacts and publishes JUnit results even when tests fail; the pipeline then reports the failed test action. Pipeline executions are queued to avoid concurrent pipeline runs against the same configured test environment.

Prerequisites:

- An AWS account/CLI identity with permission to create CodePipeline, CodeBuild, IAM, S3, and a CodeConnections connection.
- A GitHub CodeConnections connection authorized for this repository.
- A Secrets Manager secret whose JSON object contains the environment keys listed in `.env.example` (including `RP_ENDPOINT`, `RP_PROJECT`, `RP_API_KEY`, `RP_LAUNCH`). Configure the secret value in AWS; do not put it in `terraform.tfvars`.
- A globally unique private artifact bucket name.

Configure `aws-pipeline/terraform.tfvars` using `terraform.tfvars.example`, then run:

```powershell
cd aws-pipeline
terraform init
terraform validate
terraform plan
terraform apply
```

After deployment, the pipeline starts on commits to the configured branch. AWS pipeline artifacts and CodeBuild logs contain test output; ReportPortal receives each launch when configured.
