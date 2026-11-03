# Restaurant AQA Framework

## Direction and approach

Track 1: Playwright + TypeScript, using a Page Object Model for UI interactions and direct API requests for setup/authorization checks. The target is the deployed application configured through environment variables.

## Local setup

1. Copy `.env.example` to `.env`.
2. Set valid frontend/API URLs, owner and guest test credentials, and separate IDs for view, submit, forbidden-submit, and empty-group test data. Use dedicated test data only.
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

The current tests are a scaffold, not complete assignment coverage: they exercise owner viewing/submission, a non-owner submit attempt, and an empty-group response. Level 3 has no tests yet, and further Level 1/2 positive and negative scenarios must be added.

## Test data and behavior

Use separate, dedicated groups for viewing, submission, authorization, and the empty-group case. The submission UI test changes the group status, so do not point it at customer data or reuse its reservation for another test. Separate IDs prevent these tests from mutating one another when run in parallel. Test data setup/cleanup is not automated yet; the current IDs must be prepared for each run, and the submission group must be replaced after it is submitted. The app has no hard-delete cleanup API for reservations. This is a known gap against the assignment's unique-per-run data and cleanup requirements.

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
