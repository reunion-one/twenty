# Workspace transaction sessions

Sessions are process-local and require every request for a transaction to reach the same Twenty API process. They use one connection from the existing primary workspace pool for the session lifetime.

Only workspace record REST routes backed by the Common Query Runners participate. GraphQL, metadata, workflow, email, queue, external HTTP, custom resolver, and other non-record APIs do not participate.
