// AUTO-GENERATED from redirects/redirect-map.csv by redirects/generate.mjs.
// Do not hand-edit. Run `npm run redirects:generate` after editing the CSV.

const REDIRECT_MAP = {
  "/datagriff/2025/08/15/simplify-python-package-development-with-uv-and-taskfile.html": "/blog/2025-08-15-simplify-python-package-development-with-uv-and-taskfile/",
  "/datagriff/2025/03/25/render-beautiful-api-contract-docs-with-docusuarus.html": "/blog/2025-03-25-render-beautiful-api-contract-docs-with-docusuarus/",
  "/datagriff/2024/12/22/create-a-cracker-of-an-open-api-contract-with-vs-code-spectral-prism-and-schemathesis.html": "/blog/2024-12-22-create-a-cracker-of-an-open-api-contract-with-vs-code-spectral-prism-and-schemathesis/",
  "/datagriff/2024/12/13/deploy-event-catalog-on-azure-static-web-apps.html": "/blog/2024-12-13-deploy-event-catalog-on-azure-static-web-apps/",
  "/datagriff/2024/12/02/deploy-docusaurus-on-azure-static-web-apps.html": "/blog/2024-12-02-deploy-docusaurus-on-azure-static-web-apps/",
  "/datagriff/2024/10/20/distributed-reporting-mesh-with-duckdb-and-streamlit.html": "/blog/2024-10-20-distributed-reporting-mesh-with-duckdb-and-streamlit/",
  "/datagriff/2024/08/15/protecting-code-quality-with-trunk.io.html": "/blog/2024-08-15-protecting-code-quality-with-trunkio/",
  "/datagriff/2024/08/13/git-conventional-vs-code-workflow.html": "/blog/2024-08-13-git-conventional-vs-code-workflow/",
  "/datagriff/2024/06/29/cosmos-emulator-docker-local.html": "/blog/2024-06-29-cosmos-emulator-docker-local/",
  "/datagriff/2024/04/27/container-react-runtime-variables.html": "/blog/2024-04-27-container-react-runtime-variables/",
  "/datagriff/2024/03/31/shift-left-with-scripts.html": "/blog/2024-03-31-shift-left-with-scripts/",
  "/datagriff/2024/02/24/okr-agile-cycles.html": "/blog/2024-02-24-okr-agile-cycles/",
  "/datagriff/2024/01/28/github-add-to-project.html": "/blog/2024-01-28-github-add-to-project/",
  "/datagriff/2024/01/07/azure-terraform-export.html": "/blog/2024-01-07-azure-terraform-export/",
  "/datagriff/2023/12/30/postman-vscode-marvel.html": "/blog/2023-12-30-postman-vscode-marvel/",
  "/datagriff/2023/11/11/blog-comments-giscus.html": "/blog/2023-11-11-blog-comments-giscus/",
  "/datagriff/2023/10/29/cloud-dev-platform-template.html": "/blog/2023-10-29-cloud-dev-platform-template/",
  "/datagriff/2023/09/30/ai-architecture-pt1.html": "/blog/2023-09-30-ai-architecture-pt1/",
  "/datagriff/2023/09/09/dotnet-api-container-gitpod.html": "/blog/2023-09-09-dotnet-api-container-gitpod/",
  "/datagriff/2023/08/23/pass-databricks-analyst.html": "/blog/2023-08-23-pass-databricks-analyst/",
  "/datagriff/2023/08/07/net-core-api-distilleries.html": "/blog/2023-08-07-net-core-api-distilleries/",
  "/datagriff/2023/06/03/seo-optimisation.html": "/blog/2023-06-03-seo-optimisation/",
  "/datagriff/2023/05/14/pass-spark-exam.html": "/blog/2023-05-14-pass-spark-exam/",
  "/datagriff/2023/04/30/terraform-azure-data.html": "/blog/2023-04-30-terraform-azure-data/",
  "/datagriff/2023/04/14/local-install-spark.html": "/blog/2023-04-14-local-install-spark/",
  "/datagriff/2023/03/27/ga4-gtm-quickstart.html": "/blog/2023-03-27-ga4-gtm-quickstart/",
  "/datagriff/2023/03/11/cookie-consent.html": "/blog/2023-03-11-cookie-consent/",
  "/datagriff/2023/02/27/data-layer.html": "/blog/2023-02-27-data-layer/",
  "/datagriff/2023/02/20/track-your-beer-with-a-tag.html": "/blog/2023-02-20-track-your-beer-with-a-tag/",
  "/datagriff/2023/01/21/docker-clean.html": "/blog/2023-01-21-docker-clean/",
  "/datagriff/2023/01/02/docker-environment-variables.html": "/blog/2023-01-02-docker-environment-variables/",
  "/datagriff/2022/12/21/react-basic.html": "/blog/2022-12-21-react-basic/",
  "/datagriff/2022/11/27/fastapi-gen.html": "/blog/2022-11-27-fastapi-gen/",
  "/datagriff/2022/11/12/docker-beer.html": "/blog/2022-11-12-docker-beer/",
  "/datagriff/2022/11/06/fast-api.html": "/blog/2022-11-06-fast-api/",
  "/datagriff/2022/10/22/get-by-with-git.html": "/blog/2022-10-22-get-by-with-git/",
  "/datagriff/2022/10/02/beautiful-soup.html": "/blog/2022-10-01-beautiful-soup/",
  "/datagriff/2022/09/25/flask-api.html": "/blog/2022-09-25-flask-api/",
  "/datagriff/2022/09/17/team-okr-hdd.html": "/blog/2022-09-17-team-okr-hdd/",
  "/datagriff/2022/07/19/environment-variables.html": "/blog/2022-07-19-environment-variables/"
};

const APEX = 'https://hungovercoders.com';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const newPath = REDIRECT_MAP[url.pathname];

    if (newPath) {
      const target = new URL(newPath, APEX);
      target.search = url.search;
      return Response.redirect(target.toString(), 301);
    }

    return Response.redirect(APEX + '/', 301);
  },
};
