import { integrationStatuses } from "@/integrations"

import { IntegrationStatusTable } from "./IntegrationStatusTable"

/** The Integrations global's status table, read from this server's environment on each view. */
export function IntegrationStatusField(): React.ReactNode {
  return <IntegrationStatusTable statuses={integrationStatuses()} />
}
