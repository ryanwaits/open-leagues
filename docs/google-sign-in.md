# Google sign-in

Self-host can offer **Continue with Google** using *this app's* OAuth client.
Email/password stays on. X native is not shipped (broker or nothing).

1. Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client (Web).
2. Authorized JavaScript origin: `https://YOUR_HOST` (local: `http://127.0.0.1:8080`).
3. Authorized redirect URI (exact):

   ```
   https://YOUR_HOST/api/auth/callback/google
   ```

   Local: `http://127.0.0.1:8080/api/auth/callback/google`. Must match
   `BETTER_AUTH_URL` (scheme + host + port, no trailing slash).
4. Put `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`. Never `VITE_`.
5. Restart the container / `bun run dev`.

## Verify

| Expect | How |
|--------|-----|
| Off, no broker | `/login` is email only. Copy does not mention Google. |
| Both env vars set | `/login` shows **Continue with Google**. Copy: "Google is available on this host." |
| Sign-in | Button → Google account chooser → back on this origin, signed in. |
| Broker already on | One Google button (broker), not two. |

`bun test src/lib/auth/providers.test.mjs` covers the empty-env / both-vars button list.
