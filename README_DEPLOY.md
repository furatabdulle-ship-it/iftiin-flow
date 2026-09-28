# Deploy to iftiin-flow.com via GitHub Pages

Publish these files at the root of the GitHub repository that currently serves iftiin-flow.com.

Required root structure:
- index.html
- about.html
- speaking.html
- CNAME
- assets/

Keep CNAME exactly:
iftiin-flow.com

Do not upload Code.gs to the public website repository. Deploy Code.gs separately from a Google Sheet via Extensions > Apps Script, then paste the Web App /exec URL into the website's APPS_SCRIPT_URL constant.
