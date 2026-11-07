# HOME SECURITY / supabase/migrations

Wersjonowane zmiany schematu i uprawnień Supabase. **Nie zmieniaj nazw ani kolejności zastosowanych migracji**.

| Plik lub katalog | Do czego służy |
| --- | --- |
| [`20261014170000_add_account_access_roles.sql`](20261014170000_add_account_access_roles.sql) | Dodanie ról dostępu do kont |
| [`20261014170500_harden_account_role_functions.sql`](20261014170500_harden_account_role_functions.sql) | Wzmocnienie bezpieczeństwa funkcji ról |
| [`20261014171000_lock_down_account_role_assignment.sql`](20261014171000_lock_down_account_role_assignment.sql) | Ograniczenie przydzielania ról |
| [`20261107103600_remote_phone_unlock.sql`](20261107103600_remote_phone_unlock.sql) | Zmiany bazy dla zdalnego odblokowania telefonem |

## Zasady dla agentów

Przejdź do [README głównego](../../README.md), [mapy kodu](../../docs/REPO-MAP.md) i [instrukcji agentów](../../AGENTS.md). Sprawdź, do czego plik jest używany, przed jego przeniesieniem. Nie zmieniaj publicznych adresów i nazw instalatorów z powodu porządkowania katalogów.
