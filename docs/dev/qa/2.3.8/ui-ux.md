# SubtleForms 2.3.8 UI and UX design review (area: ui-ux)

Site: http://localhost:8931 (/home/claude/wp/audit238b). Free 2.3.8, Pro 2.3.3, License Server 1.6.0, block theme "subtleforms-site".
Screenshots: /home/claude/shots/qa238/ui-ux/ (about 300 files; names below are relative to that folder).
Scripts: /home/claude/work/qa238/ui-ux/ (Playwright + axe-core, Chromium /opt/pw-browsers/chromium).
Viewports: 1440x900, 1024x768, 390x844. Every screenshot named in this report was opened and looked at.
The re-verification part of the common brief does not apply to this area (no previous ui-ux report).

## 1. Summary

The admin already looks like one product: one top bar, one card style, skeleton loaders, a real reading pane, sensible empty states, and the primary colour follows the WordPress admin colour scheme. The public form is clean and passes axe on the default presets. What still makes it feel unfinished is a short list of visible breakages and a long tail of inconsistency.

Top problems, most serious first:
1. Four things look broken to a first-time user: the builder header overflows at 1440 (status pill covers the Preview/Entries tab), Desktop preview is clipped behind the Appearance panel, the conversational radio question renders as a broken slider row, and the payment Coupon box collapses to a 16px square on phones (UX2-01 to UX2-04).
2. Failure looks like data loss: when the forms request fails, All Forms shows "Create your first form" (UX2-05); a failed builder save only says "Could not get a valid response from the server." (UX2-06); the builder loading state is a black screen (UX2-07).
3. Two presets fail contrast or are unusable on a light theme: Dark surface text is 1.09:1 on a white page, Dark and Bold buttons are 3.48:1 and 3.91:1 (UX2-08).
4. The same idea has different names: Standard / Single page / Regular / Sectioned; Settings / Settings; Appearance / Style; Payments in three places; Title Case, UPPERCASE and sentence case labels side by side (UX2-12 to UX2-15).
5. Confirmations are a mix of app modals, native confirm() and native alert() (UX2-10). Deleting a field with the Delete key gives no undo toast (UX2-11).
6. Phone and 1024 layouts: tables do not reflow, the builder at 390 is a broken header with no "use a larger screen" note, the reading pane toolbar overflows, and on any 768px tall screen a dark band appears under the app when the page scrolls (UX2-16 to UX2-19).
7. Accessibility: focus ring on the Forms status tabs is clipped to a 2px vertical sliver, row checkboxes are 16x16, public radios and checkboxes are 13px native controls, input focus is a 1px box-shadow, chart bars carry aria-label on a role-less div (44 axe nodes), an unlabelled select on Forms and Submissions, grey #949494 text fails contrast in several places (UX2-20 to UX2-24).
8. Numbers disagree: Dashboard "Last 7 days 272" vs Reports "Last 7 days 209" for the same site and minute (UX2-09).
9. The onboarding wizard is hidden in a help menu, uses a different visual language and vocabulary ("Regular", "Sectioned"), and does not fit in a 900px tall window; the builder tour copy names buttons that no longer exist (UX2-25, UX2-26).
10. Public forms cause a large layout shift on load (CLS 0.35 desktop, 0.71 phone) because the form mounts with no reserved height and pushes the footer (UX2-27).

## 2. Measurements (perceived speed)

Rough Playwright timings, logged-in admin, local PHP server (ms from navigation start). "Ready" is the first time the page header or canvas is in the DOM; "idle" is network idle. CLS is cumulative layout shift.

| Screen | 1440 ready / idle | 1024 idle | 390 idle | CLS (worst) |
|---|---|---|---|---|
| Dashboard | 1580 / 2904 | 2080 | 1707 | 0 |
| All Forms | 848 / 2256 | 2670 | 1906 | 0.005 |
| New form (templates) | 854 / 1470 | 2248 | 1347 | 0.709 at 390 |
| Submissions | 813 / 2156 | 2468 | 1786 | 0.001 |
| Tools | 642 / 1250 | 1930 | 1556 | 0.125 at 390 |
| Reports | 741 / 1701 | 2031 | 1803 | 0 |
| Payments | 721 / 1592 | 2176 | 1580 | 0 |
| Extensions | 997 / 1430 | 1260 | 1136 | 0 |
| Settings | 967 / 1635 | 1972 | 1481 | 0.087 at 390 |
| Builder (11 fields) | 2481 / 2729 | | | 0 |
| Create blank form to builder ready | 3967 total | | | |
| Open entry in reading pane | about 1700 | | | |
| Entry detail page (No split) | about 2140 | | | |
| Public standard form | 628 to 1630 | | | 0.348 desktop, 0.707 phone |
| Public payment form | 696 to 1013 | | | 0.257 desktop, 0.676 phone |
| Public newsletter inline | 621 to 1693 | | | 0.003 desktop, 0.122 phone |
| Public conversational | | | | 0.087 desktop, 0.329 phone |
| License area (My Account, Licenses, Pro downloads, Connect) | server rendered | | | 0 |

What it means: admin screens are acceptable (under 1 s to header, 1.5 to 3 s to data) and use skeletons, which feel fast (loading-forms-list.png, loading-submissions.png). The builder and the create flow are the slowest and the builder shows a black screen while it loads (UX2-07). Public forms shift the page badly (UX2-27).

## 3. Screen by screen

Comparison notes refer to Fluent Forms, WPForms and Gravity Forms from working knowledge of their current admin UIs.

### 3.1 Top bar and navigation (all admin screens)
Screens: dashboard-1440.png, forms-1024.png, dashboard-390.png, submissions-390.png, top-help-menu.png, forms-help.png, scheme-ectoplasm-forms.png, scheme-ectoplasm-builder.png, band-1024-scrolled.png.
Works: one consistent top bar with icons and labels, current page highlighted, unread badge, plan badge, help menu with version number. The primary button, tab underline and badge follow the WordPress admin colour scheme (checked with Ectoplasm), which Fluent Forms and WPForms do not do.
Problems:
- Information architecture: the top bar duplicates the WordPress submenu with different names ("All Forms" vs "Forms", "Add New" vs "New form") and different highlighting (New form page highlights "Forms" in the top bar but "Add New" in the WP menu). The unread badge says "99+" in the top bar and "208" (later "1483") in the WP menu.
- Two help buttons: a page-level "?" (Quick Start Wizard, Email merge tags, View Documentation) and a global "?" (Documentation, Get support, What's new). Same icon, different content, and the onboarding wizard is only reachable from the page-level one.
- Responsive: at 1024 the top bar drops to icons only with no visible labels; at 390 only the current item shows a clipped label ("Submi") and the rest are icon buttons without text.
- Layout: the app is a fixed 100vh panel inside wp-admin. When the WP menu is taller than the window (any 768px tall screen, or 900px with WooCommerce menus), the window scrolls and a dark band appears under the app (band-1024-scrolled.png, also visible at the bottom of every 1440 full-page shot).
- Compare: Gravity Forms keeps only the WP submenu and a slim header; WPForms and Fluent Forms use a branded header plus the WP submenu but keep the names identical. SubtleForms is better on colour scheme support, worse on duplicate naming.

### 3.2 Dashboard
Screens: dashboard-1440.png, dashboard-1024.png, dashboard-390.png, dashboard-bottom.png, top-help-menu.png.
Works: clear KPI row, 14-day chart, quick actions, recent submissions, recently edited forms, system status.
Problems:
- Data consistency: "Last 7 days 272" while Reports says "Last 7 days 209" at the same moment (UX2-09). "Across 38 forms" counts every form, not forms with submissions. "Create a form: start blank or from 50+ templates" while New form says 59. "Form performance: Submissions 1,533" (30 days, from Pro stats) sits under a "Submissions 323" total.
- Hierarchy: "Form performance" has a search box and a select stacked on top of each other at the right, which looks like two unrelated controls.
- Copy: status words in Recent submissions mix "Received", "Completed", "Failed" without explanation. System status shows "Database 8.0.38" on a SQLite site and "Memory limit -1".
- Accessibility: 44 chart bars use aria-label on a div with no role (axe aria-prohibited-attr, serious).
- Compare: WPForms and Fluent Forms dashboards are mostly upsell widgets; SubtleForms' dashboard is more useful. Gravity Forms has no dashboard page.

### 3.3 All Forms (with and without forms)
Screens: forms-1440.png, forms-1024.png, forms-390.png, forms-rowmenu.png, forms-viewmenu.png, forms-search-empty.png, forms-trash-empty.png, forms-bulk.png, forms-help.png, forms-empty.png (forced empty list), error-forms-list.png, loading-forms-list.png, toast-form-trash.png, focus-forms-list.png.
Works: status tabs with counts, column picker, search, skeleton loading, separate empty states for no forms, no search results and empty Trash, bulk bar, row menu with icons, Move to Trash confirmation, one-time tip banner.
Problems:
- Error state: when the request fails, the list shows "Create your first form" (UX2-05).
- Visual: the Shortcode column wraps `[subtleforms id="315"]` onto two lines in a grey mono pill on every row; "Conversion (30 days)" shows "- / 0 views · 0 sent" on almost every row, which is noise for free users. A "New" badge sits on many old drafts.
- Navigation: the form title is not a link (rows open on click; keyboard users must find the hidden pencil). WordPress list tables make the title the link.
- Accessibility: the focus ring of the status tabs is clipped to a thin vertical line (focus-forms-list.png); row checkboxes are 16x16 (below the 24px target size); the "Rows per page" select has no accessible name (axe select-name, critical); the View menu does not close on Escape (forms-search-empty.png shows it still open over the empty state).
- Copy: Title Case in column names and bulk buttons ("Last Updated", "Mark as Published", "Move Form to Trash") while the rest of the app is sentence case.
- Responsive: at 1024 the Entries, Conversion and Updated columns and the row actions are cut off with no horizontal hint; at 390 the table keeps desktop columns, rows grow to 120px and checkboxes render as 44px empty squares.
- Compare: WPForms and Gravity Forms use the WP list table (title link, row actions under the title, responsive collapse). Fluent Forms uses its own table with a toggle column. SubtleForms is better on empty and loading states, worse on keyboard access and phone layout.

### 3.4 New form, template library and create modals
Screens: newform-1440.png, newform-1024.png, newform-390.png, newform-blank-modal.png, newform-search-empty.png, tpl-grant-hover.png, tpl-grant-click.png, p5.png.
Works: category list with counts, search with "/" shortcut, good empty search state with "Start blank", template modal lists included fields, form name preselected.
Problems:
- Copy conflict: the modal says the form name is "Only you see this. You can show a different title on the page." while Form settings > General says "The name shown to you and your visitors for this form." (UX2-14).
- Vocabulary: the blank modal offers "Single page / Multi-step / Conversational" while the builder and list say "Standard". The Payments category holds "Payment form" and "Donation form" templates with no payment field at all (text, select, number only).
- Thumbnails are near-identical grey wireframes, so the grid does not help choosing; hover shows "Use template" over the thumbnail.
- Searching "Grant" shows "Free Resource Download" and not the Grant Application template (which exists in /templates).
- "Back" in the modal is a link-style button next to a primary button; "Cancel" at page level is a bare link at the top right.
- Responsive: at 390 the grid keeps two 250px columns so the second column is cut off; category chips scroll sideways with no fade or arrow.
- Compare: WPForms has the strongest template picker (real previews, "Preview" button, search). Fluent Forms shows a modal with categories. SubtleForms is close to Fluent; it needs real previews to match WPForms.

### 3.5 Builder: canvas, field library, toolbar
Screens: builder-std-1440.png, builder-inspector-email-general.png, lib-search-pay.png, lib-search-empty.png, builder-delete-field.png, builder-update-menu.png, builder-shortcode-click.png, builder-std-1024.png, builder-std-1024-selected.png, builder-std-390.png, builder-std-390-selected.png, builder-blank-empty.png, loading-builder.png.
Works: three-column layout, grouped field library with search and "/" shortcut, empty search state, inline insert "+", undo/redo, keyboard hint card, autosave status, consistent toolbar on every field including containers.
Problems:
- Header overflow at 1440: as soon as the status reads "Unsaved changes" or an error shows Retry/Dismiss, the "Published, changes not live" pill overlaps the view tabs ("Previ", "Ent") and the title truncates to "QA238-ui-Sta..." (UX2-01).
- The field toolbar sits on top of the field label of the selected or hovered field, so the label is hidden while editing it; hover and selection can show two toolbars at once (error-recovered.png).
- Delete key removes a field with no confirmation and no undo toast; only the generic "Tip: Click a field (or container) to edit its settings." toast shows (UX2-11).
- Copy shortcode only swaps the icon to a check mark; no "Copied" text for sighted or screen reader users.
- Update menu: disabled items ("Publish", "Save draft", "Discard changes") are light grey with low contrast and the first disabled item gets the focus ring.
- Every Update asks "Update live form / Push your changes live?" and every first Publish asks "Publish Form / Are you ready to publish?". That is an extra click on the most frequent action; WPForms, Fluent and Gravity do not confirm Save/Update.
- Canvas vs live mismatch: canvas radios and checkboxes are 44px apart with large circles, the live form is compact; canvas file upload is a dashed dropzone, the live form is the native "Choose File" button; canvas labels carry type icons the live form does not have.
- Freshly created or REST-published forms open as "Published, changes not live" although nothing was changed.
- Empty new form: a small dashed box "Drag fields here or click + to add" and an irrelevant tip toast. EmptyFormWelcome exists in the code but did not appear.
- Loading state: black screen with a small spinner in the corner (UX2-07).
- WP admin menu stays expanded, so the canvas gets 1280px at 1440 and about 600px at 1024; at 1024 the inspector overlays the canvas.
- Phone: at 390 the header is a jumble of clipped icons ("ot live"), the title disappears and there is no message that the builder needs a larger screen (UX2-17).
- Accessibility: hidden field toolbars stay focusable inside aria-hidden (axe aria-hidden-focus, 10 nodes); canvas preview inputs and radios have no labels (axe label, 9 nodes); composite sub-labels "First Name / Last Name" are #949494 (3.03:1).
- Compare: WPForms and Fluent Forms take the full screen (hide wp-admin chrome) and never confirm Save. Gravity Forms keeps wp-admin chrome like SubtleForms. SubtleForms' library search and inline "+" are better than Gravity's; the header crowding and toolbar-over-label are worse than all three.

### 3.6 Builder: inspector (several field types)
Screens: m-insp1.png (Dropdown: Settings, Settings expanded, Validation, Logic), m-insp2.png (Dropdown Style, Name, Date, Radio), m-insp3.png (File Upload, Consent), insp-*.png.
Works: header with type icon, copyable key, duplicate/delete/close; live style preview in the Style tab; width chips; clear Validation tab with Required and both messages; Logic empty state with one action.
Problems:
- Naming: the inspector's first tab is "Settings", the same word as the builder's "Settings" view; the Settings tab contains an "Appearance" accordion and there is also a "Style" tab (UX2-13).
- Important type settings are hidden in collapsed accordions: File Upload shows only Label and Help text; allowed types and size live elsewhere. Consent shows only Label and Help text; the checkbox sentence ("I agree...") is not in General.
- Label styles mix UPPERCASE ("LABEL", "HELP TEXT", "MESSAGE WHEN LEFT EMPTY") with sentence case ("Width", "Alignment", "Space above").
- Toggles: the off state has a black knob (Show values, Integrations), the on state is blue; WordPress toggles are grey when off.
- Choices: each option has an unlabeled radio circle (default choice) with no header explaining it.
- Tabs are unevenly spaced ("Validation Logic" tight, "Style" far right).
- Logic tab repeats itself ("Show or hide... based on answers" then "Always shown. Add a rule to show or hide it based on answers.").
- Multi-step: the key of template fields is a machine id ("text_51e62af8").
- Compare: WPForms splits General / Advanced / Smart Logic; Gravity uses General / Appearance / Advanced; Fluent uses Input Customization / Advanced. SubtleForms has the cleanest Validation tab of the four but the only one with two "Settings" and an Appearance/Style split.

### 3.7 Builder: Form settings (vertical tabs) and Notifications
Screens: fs-general.png, m-fs0.png (Field defaults, Confirmation), m-fs1.png (Notifications, Availability), m-fs2.png (Integrations, Advanced), fs-pay-payments.png.
Works: grouped vertical tabs (Form, Responses, Connections, Advanced) with one-line descriptions; Form type as a segmented control with an explanation; merge tag hint under Confirmation message; Payments tab appears only for payment forms.
Problems:
- Notifications empty state: "No actions configured. Add an action to process form submissions." with "+ Send Email" and "+ Send to API" buttons glued together (no gap) and in Title Case; "action" and "API" are developer words.
- Availability uses native datetime-local inputs (mm/dd/yyyy) although 2.3.4 introduced a custom date picker for forms; the coupon modal does the same.
- Integrations: "Add people who submit this form to Mailchimp" while the plan includes Brevo and Kit.
- Advanced: "Builder canvas width" uses radio buttons where every other choice in this area is a segmented control.
- Conditional confirmations: the "Add conditional confirmation" button spans the full width, unlike every other add button.
- Global vs per-form overlap with no hint which wins: Settings > Display has "Success Message", "Redirect After Submit", "Enable Submission Limit"; per form there is Confirmation and Availability > Maximum entries. Settings > Email has "Admin Notifications" on/off; per form there is Notifications.
- Compare: Gravity Forms has the same per-form vertical structure (Form Settings, Confirmations, Notifications) and is the reference here; SubtleForms is visually cleaner but needs the "this overrides the global setting" hints Gravity shows.

### 3.8 Appearance and Preview (three sizes)
Screens: preview-desktop.png, preview-tablet.png, preview-mobile.png, appearance-custom (not captured, see section 9), preview-1024.png, preview-390.png.
Works: presets with real swatches, Custom tab, Hide styling, Desktop / Tablet / Mobile segmented control with icons.
Problems:
- Desktop preview is clipped behind the Appearance panel: Last Name, Phone and the right half of the form are cut off with no scroll and no scale-to-fit (UX2-02).
- Mobile preview has no device frame or edge, so it reads as a narrow column, not a phone.
- Discoverability: Appearance only exists inside Preview. A first-time user looking for "style" or "design" finds the Style tab of a field instead.
- Presets on the live form: see 3.15.
- Compare: WPForms puts themes in the block editor sidebar with live preview on the real page; Fluent Forms has a Style Editor in its own tab. SubtleForms' preset gallery is nicer than both, the clipping is worse.

### 3.9 Conversational and multi-step builders
Screens: builder-multistep.png, builder-multistep-selected.png, builder-conv.png (p23.png).
Works: conversational canvas with progress bar, question dots, Previous / Add question / Next; multi-step "Editing Step 1 of 4" card and step tabs.
Problems:
- Multi-step step tabs overflow: the fourth tab is cut ("4") with no scroll arrow or "more" indicator.
- Conversational: Previous is a disabled outline button at the far left, Add question is a text link, Next is primary; three different button styles in one row.
- Conversational canvas still shows the generic "No field selected" inspector until a question is clicked.

### 3.10 Submissions inbox, reading pane, densities, trash, entry detail
Screens: submissions-1440.png, submissions-1024.png, submissions-390.png, subs-gear.png (p16), subs-pane-right.png, subs-filters.png (p17), subs-trash.png, subs-search-empty.png (p18), subs-compact.png, subs-pane-below.png (p19), subs-comfortable.png, entry-detail-1440.png (p20), entry-detail-1440-bottom.png, subs-pane-1024.png (p21), subs-pane-390.png (p22), error-submissions-list.png, loading-submissions.png.
Works: the strongest screen. Clear tabs, Filters panel, density segmented control and reading pane choice in one popover with a note that it is saved per user, keyboard prev/next in the pane, "What happened next" with Actions / Log / API calls, notes, details and visitor cards, skeleton loading.
Problems:
- Right pane at 1440 squeezes the list: the Form column wraps "QA238-free-features-Inbox" onto four lines and Received disappears. At 1024 only the Submission column is left and the pane toolbar wraps ("Mark / unread", "Resend / notifications"). At 390 the pane toolbar is cut off at the right edge (close X and Flag/Delete out of view) and the status tabs overlap ("Flagged Trash").
- Search with no results shows "No submissions here. Entries show up the moment a visitor sends one of your forms." instead of "No submissions match ..." (Forms has the right wording). The Filters button shows an active dot when only a search is set.
- Trash: every row repeats a red "Trashed" pill; there is no "Empty Trash" action in view; relative time says "1 hours ago" (UX2-28).
- Orphan entries show "Unknown Form" with no explanation (form deleted).
- Load error: "Failed to load submissions" banner with a close X but no Retry button and an empty area below.
- Contrast: entry ids #949494 on white 3.03:1 (11 axe nodes); "No actions ran" #949494 (3.03:1); selected row meta 4.34:1.
- Copy: "Field keys" toggle in the Answers card is developer jargon; "Resend notifications" is long for a toolbar.
- Entry detail: "Add note" button disabled-looking grey even before typing; "Browser: Unknown".
- Compare: Gravity Forms has a WP list table and a full entry page (no pane); WPForms has a list and an entry page; Fluent Forms has an entry drawer. SubtleForms' reading pane, densities and "what happened next" are better than all three; responsiveness of the pane is worse than Fluent's drawer.

### 3.11 Payments
Screens: payments-1440.png, payments-coupon-modal.png (p6), payments-coupon-delete.png, payments-gateway.png (p7).
Works: gateway / currency / coupons KPI cards, three-step "how payments work", WooCommerce note, coupon table with status pills, coupon modal with Generate.
Problems:
- Header buttons have no gap between icon and text ("⚙Gateway settings", "+New coupon"); Forms and Submissions buttons do have the gap.
- Content width stops at 1328 while header buttons align at 1400 (right edges do not line up). Same on Extensions (1208 vs 1400).
- Copy vs behaviour: the page says "Until then, payment forms still work: entries are saved as 'Payment pending' so you can collect payment offline." With the gateway not connected, the live payment form refused the entry ("Online payment is not available right now.") and stored nothing (UX2-29).
- Coupon delete uses native window.confirm (PaymentsPage.jsx:353), the coupon modal uses native date inputs and its footer is below the fold at 900px tall.
- Payments lives in three places: Payments page, Extensions > Payments ("Set up"), Settings > Integrations > Payments (Enable Payments). "Gateway settings" lands on the third.
- Compare: WPForms puts payments under Settings > Payments plus a per-form Payments tab; Fluent Forms has a Payments section with transactions. SubtleForms' overview is clearer than both, the three entry points are worse.

### 3.12 Reports and Tools
Screens: reports-1440.png, tools-1440.png, tools-migrate.png, tools-activity.png (p14), tools-webhooks.png, tools-api.png (p15).
Works: Reports KPI row and 7-day chart; Tools left nav with Transfer, Migrate, Activity, Webhooks, API; clear export/import panels.
Problems:
- Reports "Form performance" shows Submissions 1,533 and Views 5,928 for 30 days while the KPI says 323 submissions in total (two data sources, no explanation).
- Activity and Webhooks logs are developer output: "Step action:save:0: succeeded", "Step zapier:f1Kas3cqbDEJ: async_failed", Form column always "-". Dates are raw ISO ("2026-10-14 18:04:16") while lists use "4 days ago" and "Oct 12, 2026". API log shows "User #1" instead of a name.
- Tools content is full width while Settings content is capped at about 760px.
- Compare: WPForms has Tools > Logs with similar raw output; Gravity has a system status page. Plain-language log lines would put SubtleForms ahead.

### 3.13 Settings (every group), License, Extensions
Screens: settings-1440.png, settings-general-bottom.png, settings-frontend.png (p9), settings-email.png, settings-email-bottom.png (p10), settings-advanced.png, settings-advanced-bottom.png (p11), settings-ai.png, settings-license.png (p12), settings-license-bottom.png, settings-branding.png (p13), settings-extensions.png, extensions-1440.png, extensions-configure.png, extensions-setup.png (p8), settings-390.png.
Works: grouped vertical nav (Forms / Pro), each group with a description, License card with plan, sites, renewal and a clear "This site is recognised as staging", Branding with a sensible "What clients see" section, Danger zone separated.
Problems:
- Labels: four styles on one page ("DEFAULT NEW FORM STATUS" uppercase, "Autosave Interval (seconds)" Title Case, "Enable Autosave" Title Case toggle, "Data Retention Period (days)"). Options in Title Case ("Soft Delete (Move to Trash)").
- Spelling mixes UK and US ("behaviour" in Display, "DELETE BEHAVIOR" in General, "organisation" in templates, "color" elsewhere).
- Save placement differs: top-right "Save" on most groups, hidden on License, a separate "Save branding" at the bottom of Branding, and the disabled top "Save" is a pale blue that reads as broken.
- Extensions page and Settings > Integrations show the same list; "Configure" and "Set up" just jump to Settings. Extensions is a second door to the same room.
- AI assistant: model names are dated ("OpenAI (GPT-4, GPT-3.5)", "GPT-3.5 Turbo (Faster, Lower Cost)"); "Test Connection" is a disabled grey button with no hint why.
- Native alert() for "Send test email" result and confirm() for "Reset All Settings".
- Phone: the group nav becomes a horizontal strip with the fourth icon cut off and no indicator.
- Compare: Gravity Forms and WPForms use plain WP settings pages with tabs; SubtleForms looks more modern but less consistent inside each page.

### 3.14 First-run onboarding and tour
Screens: onboard-forms-first.png, onboard-wizard-1.png to onboard-wizard-5.png (p31 to p33), tour-or-empty-1.png, builder-blank-empty.png (p34), builder-help-menu.png, tour-1.png to tour-9.png (p35 to p37).
Works: the tour has a progress bar, Back / Skip Tour / Next and a spotlight; the wizard has a progress bar and field suggestions.
Problems:
- A new admin user saw neither the wizard nor the tour automatically, also not after creating a blank form; both are only in help menus.
- The wizard is a different design language: large centred 24px headings, tile grid, its own button styles, "Create Form" Title Case.
- Vocabulary: "Regular", "Multi-Step", "Sectioned", "Conversational"; "Sectioned" exists nowhere else in the product (UX2-12). Field suggestions show raw types ("text • Required").
- Fit: at 1440x900 the wizard body is cut (title "Choose your form type" cropped at the top, cards cut at the bottom) and the help popover that opened it stays open on top.
- Tour: the help popover stays open over step 1; step 1 tooltip is flush against the left edge; step 4 scrolls the whole window so the header disappears and the tooltip is cut off at the top; step 6 "Field Inspector" spotlights an empty inspector ("No field selected") while the copy says "Configure the selected field here"; step 1 copy says "use Save, Publish, or Delete buttons" but the header has Update and a menu (UX2-26). Next steps in the last wizard step are blue like links but are not links.
- Compare: WPForms opens a guided "Challenge" on first activation; Fluent Forms shows a welcome screen with video; Gravity has a setup wizard on activation. All three start automatically once. SubtleForms has the content but hides it.

### 3.15 Public forms: standard, multi-step, conversational, payment, newsletter, presets
Screens: q1.png (standard desktop: initial, error, success), q2.png (standard phone), pub-ms-existing-d.png, q3.png (conversational), q4.png (payment), q5.png (newsletter), q6.png (phone set), g1.png and g2.png (11 presets desktop, error + focus state), g3.png (11 presets phone), pub-*-focus.png.
Works: clean typography, error summary plus inline messages, first invalid field focused, required stars, success card with icon, conversational progress and "Press Enter", multi-step stepper, newsletter inline row. axe passes on Theme, Default, Minimal, Soft, Bordered, Compact, Rounded and Classic, before and after a failed submit.
Problems:
- Conversational radio question on desktop renders as a broken row: circles in the middle on a track line, labels wrapped and right-aligned at the far right (UX2-03).
- Payment form on phone: the Coupon input collapses to a 16px square with "Apply" floating (UX2-04). Quantity stepper shows an empty value instead of 0 or 1; the coupon placeholder and the typed code are forced to uppercase; "Pay now" stays enabled with "Online payment is not available right now." under the card fields.
- Presets: Dark surface on a light theme is invisible (title and labels 1.09:1); Dark makes unchecked radios and checkboxes look filled (both "Starter" and "Growth" look selected); Dark button 3.48:1 and Bold button 3.91:1 fail AA (UX2-08). The error summary pink box is the same in every preset, including Dark.
- Native 13px radios and checkboxes in every preset, while text inputs are fully styled; target size under 24px on phones.
- Focus ring on inputs is a 1px box-shadow with outline none (pub-std-d-focus.png); visible but thin. Buttons get a 2px outline.
- File upload: native "Choose File" control and a long list of extensions ("PDF, DOC, DOCX, TXT, RTF, ODT, XLS, XLSX, CSV, PPT, PPTX, JPG, JPEG, PNG, GIF, WEBP, ZIP up to 10.0 MB").
- The form title repeats the page title by default ("QA238-ui-Standard page" then "QA238-ui-Standard").
- The standard Submit is a small left button, multi-step Next is full width, conversational Next is full width, newsletter Subscribe sits inline; button width rules differ by form type.
- Newsletter inline error: the button no longer lines up with the input (input moves down, button stays), and the error summary is wider than the form.
- Phone success: the theme's sticky header covers the top of the success card after the scroll (pub2-std-m-after.png); scroll targets ignore sticky headers.
- Minimal preset: the Message textarea is a single underline and does not read as a multi-line field.
- Layout shift on load (UX2-27).
- "Press Enter" hint in conversational is #979da8 (2.72:1); order summary "Nothing selected yet" 4.37:1.
- Compare: WPForms' modern markup styles radios and checkboxes and ships themes with checked contrast; Fluent's conversational forms are the reference for that mode and do not break on choice questions; Gravity's Orbital theme reserves height and has good focus rings. SubtleForms' error summary and presets are on par; the conversational choice layout, the coupon collapse and the dark presets are worse.

### 3.16 License server customer area (My Account, Licenses, Pro downloads, Connect site)
Screens: ls-account-d.png, ls-licenses-d.png, ls-downloads-d.png, ls-connect-d.png (l1.png, l2.png), ls-licenses-m.png, ls-downloads-m.png, ls-connect-m.png (l3.png), plus -t (1024) versions.
Works: Licenses card with key, copy, renew, connected sites with staging note and Deactivate; Connect site page is focused and clear (site, license choice, Connect / Cancel, signed-in account, Need help?) and stacks correctly on phones. No axe violations, no layout shift.
Problems:
- Contradiction: with an Active Agency license renewing in 2027, Pro downloads shows "Renew to download" for the latest release and "Not available" for every older version; the Licenses page says "Use the Download Pro button" but there is no such button and adds "The Pro download appears here as soon as the first release is published." (class-sfls-account.php:714-716 prints "Renew to download" whenever $may is false and the user has any license, without checking why).
- Version confusion: My Account says "Latest Pro version 9.2.0" while the site runs Pro 2.3.3 (test data, but the screen shows it without context).
- Account nav items have 46px gaps in a narrow card; on phones the nav takes the first full screen before any content.
- Header avatar next to "My licenses" is a broken image.
- "Licenses" in the nav vs "My licenses" in the header.

## 4. New bugs (UX2-NN)

| ID | Sev | Screen | Repro | Expected | Actual | Evidence | Likely cause |
|---|---|---|---|---|---|---|---|
| UX2-01 | P1 | Builder header | 1440x900, open any form, change a label (status becomes "Unsaved changes") or trigger a save error | Header items fit or collapse | "Published, changes not live" pill overlaps the Preview/Entries tabs ("Previ", "Ent"), title truncates | builder-delete-field.png, fs-general.png, error-network-update.png | resources/admin/components/builder/layout/BuilderHeaderBar.scss: fixed-width flex items with no wrap or overflow rule |
| UX2-02 | P1 | Builder Preview | Preview > Desktop with Appearance panel open | Form scaled to fit or scrollable | Right half of the form hidden behind the panel | preview-desktop.png | PreviewWorkspace: stage width 1280 inside a narrower column, overflow hidden |
| UX2-03 | P1 | Public conversational | Conversational form, radio question (product_fit_quiz Q7) on desktop | Vertical list of options | Options laid out as a slider-like row, labels right-aligned and wrapped | pub2-conv-d-after.png (q3.png right) | frontend conversational CSS for choice questions (resources/frontend/styles) |
| UX2-04 | P1 | Public payment | 390 wide, form with Coupon field | Coupon input full width, Apply beside or under | Input collapses to about 16px square | pub-pay-m-initial.png (q6.png) | coupon row flex: input has no min-width / flex-basis on narrow screens |
| UX2-05 | P1 | All Forms | Make /subtleforms/v1/forms fail (network) | Error state with Retry | "Create your first form" empty state, tab counts gone | error-forms-list.png | FormsList.jsx:173-180 sets buffer to [] on error, so the empty state renders |
| UX2-06 | P2 | Builder save | Make the schema save return 500 or abort | Message says changes are kept locally and what to do | Autosave silently stays "Unsaved changes"; later a red banner "Could not get a valid response from the server." with Retry save / Dismiss; banner stays after the connection returns | error-save-500.png, error-network-update.png, error-recovered.png | useSchemaCommands / save hook error mapping |
| UX2-07 | P2 | Builder load | Open builder with slow REST (5 s) | Skeleton of header, library, canvas | Whole screen black with a small spinner top-left | loading-builder.png | BuilderPage boot renders nothing inside a dark full-screen container |
| UX2-08 | P1 | Public presets | Apply Dark surface on the light block theme; apply Dark or Bold | Text and buttons meet 4.5:1 | Dark surface title and labels 1.09:1; Dark button 3.48:1; Bold button 3.91:1; Dark radios look checked | g1.png, g2.png, axe in section 3.15 | resources/shared/appearance.js presets dark, bold, dark-surface tokens; dark-surface relies on a dark page backdrop |
| UX2-09 | P2 | Dashboard vs Reports | Open both at the same time | Same "Last 7 days" number | 272 vs 209 | dashboard-1440.png, reports-1440.png | src/Api/DashboardApi.php:136 uses midnight 7 days ago (8 calendar days); ReportsPage.jsx:46 sums a 7-day series |
| UX2-10 | P2 | Several | Delete a coupon; Discard changes; bulk delete forms; Reset settings; Send test email; export failure | One confirmation component | Native window.confirm / alert | PaymentsPage.jsx:353, BuilderPage.jsx:566, FormsList.jsx:642, useSchemaCommands.js:165,280,360, useSettingsState.js:216, FormsPage.jsx:129, SubmissionsPage.jsx:351,357 | ConfirmModal exists (modals/ConfirmModal.jsx) but is not used everywhere |
| UX2-11 | P2 | Builder | Select a field, press Delete | Toast "Field deleted" with Undo | Field disappears silently; only a generic tip toast | builder-delete-field.png | FormEditor keyboard handler |
| UX2-12 | P2 | Wizard, create modal, builder | Compare form type names | One set of names | Standard / Single page / Regular / Sectioned / Multi-step / Multi-Step | onboard-wizard-3.png, newform-blank-modal.png, fs-general.png | OnboardingWizard.jsx:50,62,442; CreateFormModal.jsx:147,343 |
| UX2-13 | P2 | Builder | Look at builder views and inspector tabs | Distinct names | "Settings" (view) and "Settings" (inspector tab); Appearance accordion and Style tab | builder-inspector-email-general.png | BuilderViewSwitcher.jsx:11, inspector tabs |
| UX2-14 | P2 | Create modal vs Form settings | Read the help text of Form name | Same meaning | "Only you see this" vs "The name shown to you and your visitors" | newform-blank-modal.png, fs-general.png | CreateFormPage.jsx:379, FormSettings.jsx:275 |
| UX2-15 | P3 | Payments, Extensions | Look at header buttons | Icon and text spaced | No gap ("+New coupon", "⚙Gateway settings", "Agency license") | payments-1440.png, extensions-1440.png | button icon margin missing in page header actions |
| UX2-16 | P2 | All admin | 1024x768 (or any window shorter than the WP menu), scroll | App fills the window | Dark band under the app | band-1024-scrolled.png | sf-app uses 100vh with position fixed inside a scrolling wp-admin |
| UX2-17 | P2 | Builder at 390 | Open builder on a phone | Note that the builder needs a larger screen, or a usable header | Clipped icons, no title, inspector covers canvas | builder-std-390.png, builder-std-390-selected.png | no small-screen guard in BuilderHeaderBar |
| UX2-18 | P2 | Submissions pane | 1024 and 390 with Right of inbox | Pane becomes a full-width overlay on narrow screens | List squeezed to one column; at 390 toolbar cut off (close and delete hidden) | subs-pane-1024.png, subs-pane-390.png | reading pane breakpoints |
| UX2-19 | P2 | All Forms, Submissions at 390 | Phone width | Card rows or reflowed table | Desktop table with sideways scroll, 44px empty checkbox squares, tabs overlap | forms-390.png, submissions-390.png | DataTable has no mobile layout |
| UX2-20 | P1 | All Forms status tabs | Tab to "Trash" | Full visible focus ring | Ring clipped to a 2px vertical line | focus-forms-list.png | overflow hidden on the tab strip clips outline |
| UX2-21 | P2 | Dashboard, Reports | axe | No violations | aria-label on div without role (44 and 37 nodes) | crawl1.json | chart bar component |
| UX2-22 | P2 | All Forms, Submissions | axe | Labelled select | "Rows per page" select has no accessible name (critical) | crawl1.json, pane axe | pagination SelectControl without label |
| UX2-23 | P2 | Submissions, builder, public hint | axe contrast | 4.5:1 | #949494 on white 3.03:1 (entry ids, composite sub-labels, empty log text); public "Press Enter" 2.72:1 | crawl1.json, pub.json | grey token too light |
| UX2-24 | P2 | Builder canvas | axe | Hidden toolbars not focusable | aria-hidden-focus (10 nodes), unlabeled canvas inputs (9) | b1 output | FieldToolbar hidden state keeps tabbable buttons |
| UX2-25 | P2 | Onboarding wizard | 1440x900, open Quick Start Wizard | Fits and closes the help popover | Content cut at top and bottom, help popover stays open | onboard-wizard-1.png to -5.png | OnboardingWizard.scss max-height; HelpMenu does not close on select |
| UX2-26 | P3 | Builder tour | Help & tour > Start Tour | Accurate copy, stable layout | Step 1 names Save/Publish/Delete buttons that do not exist; step 4 scrolls the window; step 6 points at an empty inspector | tour-1.png, tour-4.png, tour-6.png | BuilderTour.jsx steps |
| UX2-27 | P2 | Public forms | Load a page with a form | No layout shift | CLS 0.35 desktop, 0.71 phone; source is the footer pushed down when the form mounts | pub.json, cls.js output | form container has no reserved height before React mounts |
| UX2-28 | P3 | Submissions Trash | Entry trashed 1 hour ago | "1 hour ago" | "1 hours ago" | subs-trash.png | SubmissionsTable.jsx:565-568 uses one string for all counts; utils/formatDate.js already pluralises |
| UX2-29 | P2 | Payments copy vs live form | Gateway not connected, submit a payment form | Entry saved as "Payment pending" as the Payments page says | Refused: "Online payment is not available right now.", no entry | payments-1440.png, pub2-pay-d-after.png | copy in PaymentsPage.jsx or checkout behaviour; one of them is wrong |
| UX2-30 | P3 | License server Pro downloads | Active license, release without package | "Not available yet" | "Renew to download" | ls-downloads-d.png | server160 includes/class-sfls-account.php:714-716 |

Note, not counted as a product bug: my first multi-step test form was seeded through REST from the grant_application template whose steps hold fields under "fields" without keys; the server accepted and published it and the live renderer then showed "This form couldn't load" (TypeError reading 'replace'). Forms made in the builder render fine (pub-ms-existing-d.png). The server should still refuse a schema the renderer cannot draw.

## 5. Where SubtleForms is better and worse than the big three

Better:
- Follows the WordPress admin colour scheme (checked with Ectoplasm); none of the three do.
- Submissions inbox: reading pane beside or below, densities, per-user choice, "what happened next" log per entry.
- Empty and loading states on lists (skeletons, separate empty / no results / empty trash messages).
- Validation tab: required, empty message and invalid message in one place.
- Preset gallery with real swatches; error summary on the live form.
- License area Connect site page is simpler than WPForms' or Gravity's license flows.

Worse:
- Builder header crowding, toolbar covering labels, clipped Desktop preview, black loading screen (WPForms and Fluent run full screen and never clip).
- Confirmation on every Update and Publish.
- Mixed native dialogs.
- Vocabulary drift (form type names, Settings twice, Appearance vs Style, three doors to Payments).
- Phone layouts of lists and the reading pane (Fluent's entry drawer and WP list tables reflow).
- Onboarding is hidden (all three start a guided flow on first run).
- Public form: native radios and checkboxes, two failing presets, conversational choice layout, layout shift.

## 6. Prioritised polish plan

Effort: S under half a day, M one to two days, L more than two days.

### P1: before WordPress.org submission
| # | Screen | Change | Why | Effort |
|---|---|---|---|---|
| 1 | Builder header | Let the header shrink: status pill becomes a dot with tooltip under 1600px, title gets min-width, tabs never overlap; test at 1280, 1440, 1024 | Looks broken at the most common width (UX2-01) | M |
| 2 | Builder Preview | Scale the Desktop/Tablet stage to the available width (CSS transform) or scroll it; add a thin device frame for Mobile | Looks broken (UX2-02) | S |
| 3 | Public conversational | Fix choice question layout to a vertical option list in conversational mode | Broken public form (UX2-03) | S |
| 4 | Public payment | Give the coupon input flex: 1 1 auto and min-width; stack Apply under 400px; show 0 in the quantity stepper | Broken on phones (UX2-04) | S |
| 5 | All Forms, Submissions, builder | Distinct error state with Retry for list load failures; never fall back to the empty state on error; builder save error says "Your changes are kept in this tab. Retry" and clears itself on success | Failure looks like data loss (UX2-05, UX2-06) | M |
| 6 | Presets | Dark surface paints its own background (or the picker warns "for dark pages"); darken Dark and Bold button colours to 4.5:1; style radios and checkboxes in Dark so unchecked does not look checked | WCAG AA failure on shipped presets (UX2-08) | S |
| 7 | Accessibility | Fix clipped focus ring on tabs; label the Rows per page select; role="img" or a table for chart bars; remove hidden toolbars from tab order; raise grey #949494 text to at least #707070; make row checkboxes 24px targets | axe criticals and WCAG 2.4.7, 1.4.3, 2.5.8 (UX2-20 to UX2-24) | M |
| 8 | Vocabulary | One set of form type names everywhere: Standard, Multi-step, Conversational (drop "Single page", "Regular", "Sectioned"); fix the Form name help text conflict | Confusing to a first-time user (UX2-12, UX2-14) | S |
| 9 | Builder | Delete key and toolbar delete show "Field deleted. Undo" toast | Silent destructive action (UX2-11) | S |
| 10 | Builder | Drop the "Push your changes live?" confirmation on Update (keep it only for first Publish, or neither) | Extra click on the most frequent action; none of the competitors do it | S |
| 11 | Payments copy | Make the Payments page copy match behaviour when no gateway is connected (or save entries as Payment pending as promised) | Contradiction a buyer will hit on day one (UX2-29) | S |
| 12 | Dashboard | Same 7-day window as Reports; say "across N forms with entries" or drop it; "59 templates" everywhere | Visible wrong numbers (UX2-09) | S |
| 13 | Builder loading | Skeleton of header, library and canvas instead of the black screen | Looks broken on slow hosts (UX2-07) | S |

### P2: next release
| # | Screen | Change | Why | Effort |
|---|---|---|---|---|
| 1 | All dialogs | Replace every window.confirm / alert with ConfirmModal and snackbars | Consistency (UX2-10) | M |
| 2 | Inspector | Rename inspector "Settings" tab to "Field"; merge the Appearance accordion into Style; surface type-specific settings (file types and size, consent text) in General | Discoverability (UX2-13) | M |
| 3 | Builder canvas | Move the field toolbar above the field box (outside the label); show one toolbar at a time; match canvas radios, checkboxes and file upload to the live form | Labels hidden while editing; canvas lies about the result | M |
| 4 | Builder | Collapse the WP admin menu while in the builder (folded menu) and add a "Builder needs a wider screen" notice under 900px | Space at 1024, unusable phone header (UX2-17) | S |
| 5 | Lists on phones | Card layout for Forms and Submissions under 600px; reading pane becomes a full-width overlay under 1100px | UX2-18, UX2-19 | L |
| 6 | App shell | Fix the dark band: use min-height and let wp-admin scroll, or pin the WP menu | UX2-16 | S |
| 7 | Public forms | Reserve form height (server-rendered skeleton or min-height from the schema) | CLS 0.35 to 0.71 (UX2-27) | M |
| 8 | Public forms | Styled radios and checkboxes (at least 20px, 24px target) in every preset; 2px focus ring on inputs | Consistency and target size | M |
| 9 | Onboarding | Show the wizard once automatically on first visit with no forms (or a "Start here" card), fit it in 720px height, use the app's components and vocabulary; fix tour copy and step 4/6 | First-run experience (UX2-25, UX2-26) | M |
| 10 | Settings | One label style (sentence case, not uppercase), one save location per page, UK or US spelling chosen once | Consistency | M |
| 11 | IA | One home for payments and integrations: keep Settings > Integrations, turn the Extensions page into a catalogue that links there, Payments page keeps coupons and status only | Three doors to the same room | M |
| 12 | Submissions | Search no-results message, Retry on load error, hide the "Trashed" pill on the Trash tab, add "Empty Trash", fix "1 hours ago" | Polish (UX2-28) | S |
| 13 | Forms list | Title as a link, single-line shortcode with copy icon, hide Conversion column for free users by default, sentence case | WP conventions and noise | S |
| 14 | Newsletter inline | Keep button aligned with the input when an error shows; error summary width equals form width | Visible misalignment | S |
| 15 | Notifications tab | Empty state "No emails yet. Add an email notification" with a gap between buttons; rename "Send to API" to "Send to a webhook" | Jargon | S |
| 16 | License server | "Not available yet" instead of "Renew to download" when there is no package; remove "Use the Download Pro button" when no button exists; fix the broken avatar | Customer confusion (UX2-30) | S |

### P3: later
| # | Screen | Change | Why | Effort |
|---|---|---|---|---|
| 1 | Templates | Real rendered previews and a Preview button; fix search to match titles first | Help choosing (WPForms parity) | L |
| 2 | Tools logs | Plain-language log lines ("Email to admin sent", "Webhook to hooks.example.test failed: blocked by site"), form name column, relative dates | Readability | M |
| 3 | Reports | Explain the two data sources or show one; "Views and conversion need Analytics" note | Trust in numbers | S |
| 4 | Availability, coupon modal | Use the same custom date picker as forms | Consistency | S |
| 5 | AI settings | Current model names, explain why Test Connection is disabled | Freshness | S |
| 6 | Multi-step builder | Scrollable step tabs with arrows | Overflow | S |
| 7 | Public | Do not repeat the page title as form title by default on the block; shorten the file type list ("Documents, images and ZIP up to 10 MB" with a details toggle) | Visual noise | S |
| 8 | Public | Scroll-to-error and scroll-to-success with scroll-margin-top for sticky headers | Success hidden under sticky header on phones | S |
| 9 | Dashboard | Replace "Database 8.0.38" with the real engine; hide "Memory limit -1" | Accuracy | S |
| 10 | Account area | Tighter nav spacing, collapse nav on phones | Polish | S |

## 7. Design system note

Purpose: keep future screens consistent. Values below match what most screens already use; the work is to apply them everywhere.

Spacing scale (px): 4, 8, 12, 16, 24, 32, 48. Card padding 24 (16 under 600px). Gap between cards 24. Form field gap 24 on the live form (Compact 16). Table row height 56 default, 44 compact, 64 comfortable. Never use ad-hoc 10, 14, 20.

Type scale (px / weight): page title 26/600; section title 16/600; card title 15/600; body 14/400; help and meta 13/400; table header 12/500 sentence case (no uppercase); code and keys 12 mono. Field labels in admin: 13/500 sentence case, never uppercase. One line height: 1.5 for body, 1.3 for titles.

Colour tokens (admin):
- --sf-color-primary: the WP admin scheme colour (var(--wp-admin-theme-color)), used for primary buttons, selected tabs, links, focus.
- --sf-color-text: #1e1e1e; --sf-color-text-muted: #5f6368 or darker (at least 4.5:1 on white); retire #949494 for text.
- --sf-color-border: #dcdcde; --sf-color-surface: #ffffff; --sf-color-surface-alt: #f6f7f7.
- Status: success #00704a on #e6f4ea, warning #8a5300 on #fcf3e1, danger #b32d2e on #fcecec, info uses primary. Every status pill must pass 4.5:1.
- Focus: 2px solid primary with 2px offset; never clipped by overflow.
Public presets: every preset must ship tokens that pass 4.5:1 for text and button text on its own declared background; a preset that needs a dark page must set its own background.

Component rules:
- Buttons: Primary (one per view, the main action), Secondary (outline), Tertiary (text). Icon and text gap 6px. Destructive actions use the danger colour only in the confirm step. Sizes: 32px admin, 40px public, touch targets at least 24px (44px on phones for primary actions).
- Toggles: grey when off, primary when on (WordPress style).
- Segmented control for 2 to 4 exclusive choices; radios for 5 or more; select for long lists.
- Dialogs: one ConfirmModal for every confirmation; never window.confirm or alert. Confirm only destructive or irreversible actions (permanent delete, discard), not reversible ones (Trash, Update).
- Feedback: snackbar for success with Undo when the action is reversible; inline banner with Retry for failures; empty state (icon, one-line title, one sentence, one action) distinct from no-results and from error.
- Tables: title is a link, row actions visible on focus as well as hover, sticky header, card layout under 600px.
- Loading: skeletons for lists and the builder; spinners only inside buttons.

Icon set: keep the current outline set (Lucide style, 1.5px stroke, 16px in buttons and nav, 20px in empty states). One icon per concept: Settings gear only for settings, never for "Gateway settings" and "Settings view" at once; one help icon in the top bar, not one per page.

Copy voice: plain, short, sentence case everywhere including buttons and column headers ("New form", "Move to trash", "Last updated"). Second person ("your form"). Name things the way users see them: Standard, Multi-step, Conversational; Form settings vs Field settings; Appearance for form look, Style for one field. No developer words in the UI (action, API, async_failed, field keys, machine name) unless inside an Advanced section. Pick UK or US spelling once (the code mostly uses US: behavior, color). Numbers and dates: relative for under 7 days ("2 hours ago", correct plural), then "Oct 12, 2026"; never raw ISO in user-facing lists.

## 8. Missing UX features

| Feature | Priority | Free or Pro | Reason |
|---|---|---|---|
| Undo toast for field delete, entry delete and trash | Must | Free | Safety without extra confirmations |
| Error state with Retry on every list and the builder | Must | Free | Failures currently look like empty data |
| First-run guided start (auto once) | Should | Free | All three competitors have it; content already exists |
| Small-screen notice in the builder | Should | Free | Builder is not usable on phones |
| Mobile card layout for Forms and Submissions | Should | Free | Inbox use on phones is common |
| Real template previews | Should | Free | Choosing a template from wireframes is guesswork |
| Full-screen builder mode (hide wp-admin menu) | Should | Free | Space at 1024 to 1440 |
| Styled radios and checkboxes on the live form | Should | Free | Consistency with styled inputs, target size |
| Preset contrast check in the Appearance panel | Nice | Free | Warn when custom colours fail 4.5:1 |
| Plain-language activity log | Nice | Free | Users read logs to debug notifications |
| Saved views or column sets in Submissions | Nice | Pro | Power users |

## 9. Not tested and why

- Appearance > Custom tab controls: the "Custom" control did not match my selector and the script timed out; only the preset gallery and Hide styling were seen. Not run.
- Builder Notifications editor with an existing email action (my REST-made forms had no actions; a form created in the UI gets one). The empty state was reviewed, the editor was not.
- Dependent dropdown column editor (2.3.8): owned by the fields auditors; not opened in this review.
- Entry detail delete and toasts for entry trash: my selector did not open the pane on the filtered list; form Move to Trash modal was seen, permanent delete modal was not reached.
- Screen reader output: only axe and keyboard focus checks; no NVDA or VoiceOver run.
- Template modal "Use template" from hover: the click path timed out once; template creation was reviewed through card click instead.
- Real Stripe card element: no network to Stripe; the payment form was reviewed with the gateway not connected.
- 1024 shots for every settings group and the license pages at 1024 were taken but only spot-checked.

## 10. Data and cleanup

Created on 8931: forms QA238-ui-Standard, -Multistep, -Conversational, -Newsletter, -Payment, -Presets, -Blank, -GrantUI (ids 2297 to 2302, 2308, 2312), seven QA238-ui pages, four entries, and a temporary admin user qa238ui (to see first-run states and to change density, pane and colour scheme without touching admin). All deleted at the end: entries first, then forms, pages and the user (verified 0 QA238-ui forms and 0 entries left). No plugin settings were changed. Entries 5932 and 5933 of the free-features Inbox form were opened in the reading pane; they were already read before, so nothing changed for that auditor.
