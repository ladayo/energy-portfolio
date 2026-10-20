# Energy Security Learning Portfolio — website guide

This folder is your complete website. You'll write and edit everything through a simple online **content editor** at `/admin`. You don't need to touch any code.

**What's included:** Home, About me, Learning journal, Research & projects, Topics, Resources, Contact, search, tags, related posts, sharing buttons, email sign-up, moderated comments, community guidelines, a privacy notice and an accessibility statement.

---

## 1. Put the site online (one-time setup, about 30 minutes)

You'll need two free accounts: **GitHub** (stores your files) and **Netlify** (hosts the site).

1. **Create a GitHub repository.** Sign in at github.com → **New repository** → give it a name (for example `energy-portfolio`) → **Create**. Then choose **uploading an existing file** and drag in *everything inside this folder*, not the folder itself. Commit.
2. **Connect Netlify.** Sign in at netlify.com with your GitHub account → **Add new site → Import an existing project → GitHub** → pick the repository. Netlify reads the settings automatically, so click **Deploy**. Your site will be live at an address like `https://something.netlify.app`. You can rename it under **Site configuration → Change site name**.
3. **Turn on forms.** In Netlify go to **Forms → Enable form detection**, then click **Deploy site** again from the **Deploys** tab. You should then see three forms: `contact`, `comments` and `subscribe`.
4. **Get email alerts.** Go to **Site configuration → Notifications → Emails and webhooks → Form submission notifications → Add notification**. Choose **Email notification**, enter your address, and select **Any form**. You'll be emailed whenever someone sends a message, comments or subscribes.
5. **Let the content editor sign in.**
   - On GitHub: **Settings → Developer settings → OAuth Apps → New OAuth App**. For *Homepage URL* enter your Netlify address. For *Authorization callback URL* enter `https://api.netlify.com/auth/done`. Save, then copy the **Client ID** and generate a **Client secret**.
   - On Netlify: **Site configuration → Access & security → OAuth → Install provider → GitHub** and paste both values.
6. **Point the editor at your repository.** On GitHub, open `admin/config.yml` and click the pencil icon. Change the two lines marked `CHANGE ME`: the `repo:` line becomes `your-username/your-repo-name`, and `site_url` becomes your Netlify address. Commit.
7. **Open your editor** at `https://your-site.netlify.app/admin` → **Login with GitHub**.
8. **Finish your settings.** In the editor go to **Pages & settings → Site settings** and fill in your name, add your photo and its description, paste the *Live site address*, and add any LinkedIn or ORCID links. Click **Publish**.

> **About the placeholders.** Text shown with a **yellow dashed highlight** on the site is a placeholder. In the editor, placeholders look like `[[this]]`. Replace each one with your own words, or delete it. Delete the sample comment on "Understanding the energy trilemma" before you share the site.

---

## 2. Add or edit posts

1. Go to `/admin` → **Learning journal** → **New Journal post**.
2. Fill in the title, date, entry type (Reflection, Lesson, Course insight, Key takeaways or Assignment), topics, tags and a one- or two-sentence summary.
3. Write the post in **Post body**. Use the toolbar for headings, bold, lists, quotes and links. A quote block works well for "Key takeaways".
4. Leave **Draft** ticked while you're working. When you're ready to publish, untick it and click **Publish**. The live site updates in about a minute.
5. To edit a post later, open it in the editor, make your changes and click **Publish** again. Use **Last updated** to show readers that a post was revised.

**Research & projects** works the same way. You can upload a PDF or slides with **File to download**. **Resources**, **Home page**, **About me** and the policy pages are under **Pages & settings** and **Resources**.

**Tip:** Upload images to `assets/uploads` through the editor, and always fill in a description so screen-reader users get the same information.

---

## 3. Moderate comments

Comments are set to **Moderated** by default: nothing appears on the site until you approve it.

- **New comment:** you get an email, and the comment appears in Netlify under **Forms → comments**. The `post-slug` field tells you which post it's on.
- **Approve:** in `/admin`, open that post, scroll to **Approved comments**, click **Add**, paste in the name, affiliation, date and comment, then **Publish**.
- **Remove a published comment:** delete it from **Approved comments** and **Publish**.
- **Decline or delete:** in Netlify **Forms → comments**, delete the submission, or mark it as spam.
- **Close comments** on one post by unticking **Comments open**. To turn them off everywhere, set **Site settings → Comments → Off**.

**Spam protection** comes in three layers: a hidden "honeypot" field, a time check that silently drops instant bot submissions, and Netlify's built-in spam filter. Pre-moderation catches anything that gets through those.

**Want verified sign-in instead?** Set **Site settings → Comments** to **GitHub sign-in (Giscus)**. Commenters must then sign in with a GitHub account. To set it up, create a public GitHub repository with *Discussions* turned on, install the giscus app from giscus.app, and copy the four values giscus.app gives you into the Giscus fields. You moderate those comments on GitHub, where you can hide, delete, lock or block. Bear in mind that many academics don't have a GitHub account, which is why moderated comments are the default.

---

## 4. Manage subscribers

- **Default (Netlify Forms):** sign-ups appear under **Forms → subscribe**. Use **Download as CSV** to export the list and import it into your email tool, such as Mailchimp or Buttondown. When someone asks to unsubscribe, delete their entry there and in your email tool.
- **Recommended once you're sending regularly (Buttondown):** create a free Buttondown account, then set **Site settings → Email updates → Provider** to *Buttondown* and enter your username. New subscribers will confirm by email (double opt-in), and Buttondown handles sending, unsubscribes and your subscriber list for you.

Only email people who have subscribed, and keep the privacy notice up to date.

---

## 5. Contact messages

Messages arrive by email (step 1.4) and are also listed under Netlify **Forms → contact**. Reply from your own email account. Your email address is never shown on the site.

---

## 6. Keep the site healthy

| How often | What to do |
|---|---|
| Each post | Check that links work and images have descriptions; use topics and 3–6 tags |
| Weekly | Review comments and contact messages |
| Monthly | Click through the Resources links and fix any that are broken |
| Each term | Update About me, Research & projects and the privacy notice date |
| Any time | After publishing, wait a minute and refresh the live site to check it |

- **Every change is saved in GitHub.** If something goes wrong, open the file on GitHub → **History** and restore an earlier version. In Netlify, **Deploys** lets you roll back to any earlier version of the site.
- **If the site shows an error after an edit,** go to Netlify → **Deploys**, open the failed deploy and read the log. The usual cause is a post with a missing title or date. The log names the file.
- **Adding a new topic:** add it under **Pages & settings → Topics**, then add the same name and address to the topic list at the top of `admin/config.yml` so it appears in the post editor.
- **Your own web address (optional):** Netlify → **Domain management → Add a domain**. Netlify adds HTTPS for free.

---

## 7. What's inside (for reference)

| Path | What it is |
|---|---|
| `content/` | All your words: posts, projects, resources, pages and settings (edited through `/admin`) |
| `admin/` | The content editor and its settings |
| `assets/` | Design (`css`), site behaviour (`js`), images and uploads |
| `build.js` | Runs automatically on Netlify to package the content, create share links, the RSS feed and the sitemap |
| `netlify.toml` | Hosting and security settings |

**Security and privacy built in:** HTTPS, security headers, a strict content-security policy, no tracking or advertising cookies, comments and links escaped so visitors can't inject code, external links opened safely, and the editor protected by GitHub sign-in.

**Accessibility built in:** skip link, landmarks, keyboard navigation with visible focus, text-size, dark and high-contrast options, reduced-motion support, labelled forms with clear error messages, and colour contrast that meets WCAG AA.
