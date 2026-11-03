when a signed-in user visits /dashboard without an active organization, the page renders OrgSync. It checks for an existing membership or creates an organization on the server, then activates it in the client.

Org-sync-loader is not only a ui component but also a backend component for applying organisation to new users so manual organisation is not needed.