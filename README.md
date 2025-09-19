# Wallabag Saver

This is an extension that allows users to connect to multiple Wallabag servers and save items to any of them at their discretion. Users can opt to save the current active tab, or all tabs in the current window.

## Build

Running the build script `build.sh` should create a `dist/` folder and build Chrome and Firefox versions of this extension.

## Permissions

This extension needs permissions for the following:
1. Use local storage to store server auth keys
2. Access the URL for the current tab
3. Read the current tabs that are open
4. Get all URLs for all current tabs

The only place these URLs are sent are whichever Wallabag server you specify. Nothing is tracked.

You can check out the `permissions` files here:
* [Chrome](./permissions_chrome.json)
* [Firefox](./permissions_firefox.json)

## Privacy Policy

You can view my `privacy_policy` here:

* [Chrome](./privacy_policy_chrome.html)
* [Firefox](./privacy_policy_firefox.html)

Basically, all your stuff is yours, I don't send it anywhere that you don't specify yourself, and there's no tracking or other usage in the application.

## License

MIT - do what you want, I'm not liable for anything. Good luck, have at it.
