# Automatic city updates

The About page reads `/api/location` on each visit. Its HTML keeps Beijing as
the fallback if the endpoint is unavailable. Updates do not need a redeploy.
The endpoint stores one current city and optional ISO country code in private Vercel Blob storage. It keeps
no history, coordinates, address, or public update timestamp.

## Server setup

Configure these server-only environment variables on the Vercel project
that serves `shizudio.me`, for the production and preview environments:

- `BLOB_READ_WRITE_TOKEN`: a connected **private** Blob store's read/write token.
- `LOCATION_UPDATE_TOKEN`: a random secret of at least 32 characters.

Keep both out of browser code, repository files, and URLs. Redeploy after
changing environment variables. The local `.vercel` link may identify another
project, so confirm the actual domain owner before configuring it.

Public `GET /api/location` returns `{"city":"Beijing","countryCode":"CN"}`
(or the saved location). A legacy record with no known country returns only
`city`. The About page renders a flag from a validated ISO country code,
with an accessible country name.

Authenticated `POST /api/location` accepts `city` and optionally either
`country` (a country name in any supported phone locale) or `countryCode`
(an ISO alpha-2 code such as `CN`). Never send both country fields. Codes
are normalized to uppercase; names are resolved to codes before storage.
It requires `Authorization: Bearer YOUR_PRIVATE_UPDATE_TOKEN` and
`Content-Type: application/json`. Never send the full Location object.

## iPhone shortcut

On your iPhone, open the [signed city-and-country shortcut template](https://shizudio.me/shortcuts/wandering-city-country.shortcut).
Its import question asks for your private update key. Paste the
`LOCATION_UPDATE_TOKEN` value supplied privately; never share the configured
shortcut, since it contains that key. The public template contains only a
placeholder, not a working credential.

The shortcut performs these actions (you can also create them manually):

1. **Get Current Location**.
2. **Get Details of Locations**: select **City** from the current location.
3. Add another **Get Details of Locations**: select **Country** from the same
   current location output, not the City text from the previous action.
4. **If** City **has any value**. Put the following request inside this block,
   so an unavailable city never clears the last saved one.
5. **Get Contents of URL**: `https://shizudio.me/api/location`.
   Set method to **POST**, add header **Authorization** with value
   `Bearer YOUR_PRIVATE_UPDATE_TOKEN`, and select **JSON** request body.
   Add text field **city** using the **City** output from step 2, and text
   field **country** using the **Country** output from step 3.
6. End the **If** block.

If you already installed the city-only shortcut, edit it to add the Country
action and JSON field above. Reinstallation is unnecessary, and the existing
automations can keep referencing that shortcut. The old city-only shortcut
still works: it preserves a saved country while the city is unchanged, but
clears it when the city changes so a previous country's flag is never reused.
Beijing's pre-country legacy record is recognized as China; other cities are
not guessed. Add the Country field for automatic flags on future trips.

Run it manually once on the iPhone. Allow location access and requests to
`shizudio.me` when prompted. Confirm the published city before enabling its
automatic runs. The phone resolves coordinates into a city locally through
Apple's location services; only City and Country text are posted to the website.

Create three **Time of Day** personal automations, daily at **09:00, 15:00,
and 21:00**, each running **Update wandering city** with **Run Immediately**
(or disable **Ask Before Running**, depending on iOS version). Enable
running while locked if that option is shown. These are phone automations,
not a scheduled task running on the website.

This provides automatic periodic updates, not continuous detection of a
city boundary. iOS can delay or fail a run when the phone is offline or
cannot obtain a city; the site keeps its last saved city. Add an **Airplane
Mode → Turned Off** automation for the same shortcut if you want an extra
update after flights. Initial permissions and enabling personal automations
must be completed on the iPhone.

To stop updates, disable the personal automations. To revoke a shortcut's
write access, rotate `LOCATION_UPDATE_TOKEN` and redeploy; update the phone
with the new token before re-enabling it.

Apple references: [personal automations](https://support.apple.com/guide/shortcuts/add-automations-apdfbdbd7123/ios)
and [API requests in Shortcuts](https://support.apple.com/guide/shortcuts/request-your-first-api-apd58d46713f/ios).
