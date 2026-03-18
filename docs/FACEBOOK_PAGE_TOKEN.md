# Facebook Page token for Story publishing

The error **"(#200) This app is not allowed to publish to other users' timelines"** means you are using a **User** access token. Page Stories require a **Page** access token.

## What to use

- **`FB_PAGE_ACCESS_TOKEN`** must be a **Page access token** for the Page you use in **`FB_PAGE_ID`**.
- It must have: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`.

## How to get a Page access token

### Option A: Graph API Explorer (quick test)

1. Go to [Meta for Developers](https://developers.facebook.com/) → your app.
2. **Tools** → **Graph API Explorer**.
3. In the top right, choose **User or Page** and select **your Page** (not “Me”).
4. Click **Generate Access Token** and request:
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_posts`
5. Copy the token. That is a **Page** token. Use it as `FB_PAGE_ACCESS_TOKEN`.
6. **Page token from Explorer is short‑lived.** For production, use Option B or C.

### Option B: Long‑lived Page token (no Business Manager)

1. Get a **long‑lived User token** (e.g. from your app’s Facebook Login with `pages_manage_posts`).
2. Then call:
   ```http
   GET https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token
   ```
   with that User token. Response gives each Page’s `id` and `access_token`.
3. Use the **Page** `access_token` for the Page you want to post to. That is a long‑lived Page token (no expiry in normal use). Set it as `FB_PAGE_ACCESS_TOKEN` and the Page `id` as `FB_PAGE_ID`.

### Option C: Permanent token (Business Manager + System User)

1. [Business Manager](https://business.facebook.com/) → **Business settings** → **Users** → **System users**.
2. Create a system user (or use one), generate a token for your app with the same Page permissions.
3. In **Assets** → **Pages**, add the Page to the system user and give it **Full control** (or at least “Create content”).
4. The token you generate for that system user is a **Page** token that does not expire. Use it as `FB_PAGE_ACCESS_TOKEN` and the Page ID as `FB_PAGE_ID`.

## Checklist

- [ ] Token is a **Page** token (from “User or Page” = your Page, or from `me/accounts`, or from a System User with Page access).
- [ ] `FB_PAGE_ID` is that Page’s numeric ID.
- [ ] Permissions include: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`.
- [ ] In Vercel (or your host), set `FB_PAGE_ID` and `FB_PAGE_ACCESS_TOKEN` in the environment and redeploy.

## Double slash in asset URL

If your `assetUrl` had `//api` (double slash), set **`NEXT_PUBLIC_APP_URL`** without a trailing slash, e.g.:

- `https://sports-prediction-app-zeta.vercel.app`  
- Not: `https://sports-prediction-app-zeta.vercel.app/`

The app now strips a trailing slash from the base URL when building asset URLs.
