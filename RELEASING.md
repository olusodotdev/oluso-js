# Automated releases

Release Please opens version/changelog PRs from Conventional Commits. Merging a
release PR creates immutable component tags and GitHub releases; the protected
`sdk-production` environment then publishes only package versions that do not
already exist and verifies each version in npm.

Repository setup:

1. Add a fine-grained `RELEASE_PLEASE_TOKEN` secret with contents and pull
   request write access. A separate token is required because events created by
   the default workflow token do not start publish workflows.
2. Protect the `sdk-production` environment with required reviewers.
3. Configure npm trusted publishing for this repository/workflow so publishing
   uses GitHub OIDC and provenance instead of a long-lived npm token.
4. Merge this repository before enabling conformance in the other SDK repos;
   it owns the canonical v2 contract and reusable conformance workflow.

`workflow_dispatch` defaults to a non-publishing pack dry run.
