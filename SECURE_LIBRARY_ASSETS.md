# Secure Library Assets

## Goal

Library images and videos should only be available to logged-in users with an allowed plan. The browser should not see the backend URL, internal API asset routes, or filesystem paths.

## How It Works

The database can keep the existing asset URLs:

```text
https://futureworkacademy.net/assets/1/1-skinacat.mp4
```

The backend uses only the path after `/assets/`:

```text
1/1-skinacat.mp4
```

It resolves that file under `LIBRARY_ASSETS_ROOT`.

The Library API returns signed temporary URLs:

```text
/v/<secure-token>
```

The token contains the library item ID, asset kind, user/session hash, and expiration. When `/v/<secure-token>` is requested, the backend checks:

- JWT login/session
- signed token validity
- token expiration
- token belongs to the current session
- user's current plan
- library item's allowed `plan_ids`

If allowed, the backend streams the file with HTTP Range support for video seeking.

## Local Setup

Current local folder:

```text
future-work-backend/library_data/assets
```

For this DB URL:

```text
https://futureworkacademy.net/assets/1/1-skinacat.mp4
```

The local file should exist here:

```text
future-work-backend/library_data/assets/1/1-skinacat.mp4
```

Set backend `.env`:

```env
LIBRARY_ASSETS_ROOT=E:/New Projets/M-CODE HOSTED SITES/futurework/future-work-backend/library_data/assets
LIBRARY_ASSET_TOKEN_SECRET=change_me_to_a_long_random_secret
LIBRARY_ASSET_TOKEN_TTL_SECONDS=900
```

Restart backend after changing `.env`.

## cPanel Production Setup

Place the protected files outside public web access, for example:

```text
/home/cpanel_user/future-work-backend/library_data/assets
```

Set backend `.env`:

```env
LIBRARY_ASSETS_ROOT=/home/cpanel_user/future-work-backend/library_data/assets
LIBRARY_ASSET_TOKEN_SECRET=use_a_long_random_secret_here
LIBRARY_ASSET_TOKEN_TTL_SECONDS=900
```

The frontend domain must reverse-proxy `/v/*` to the backend Node app. Do not redirect the browser to the backend URL. The browser should keep seeing:

```text
https://futureworkacademy.net/v/<secure-token>
```

If the old public `/assets/...` folder still exists under `public_html`, block direct access with `.htaccess` or remove/move it. Direct URLs like this must not remain public:

```text
https://futureworkacademy.net/assets/1/1-skinacat.mp4
```
