# Database CA certificates

`supabase-root-2021.crt` is Supabase's public root CA ("Supabase Root 2021 CA",
SHA-256 fingerprint `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`,
valid until 2031-04-26). It is the same file Supabase offers under
Dashboard → Database → SSL Configuration. It is used automatically for hosts ending in
`supabase.co` or `supabase.com`, so connections are encrypted *and* verified.

This is a public certificate, not a secret. For other hosts, set `DATABASE_CA_CERT`
to the PEM text of your provider's CA if it isn't publicly trusted.
