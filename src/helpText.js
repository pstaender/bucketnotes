export const helpText = `
## Help

### Keyboard Shortcuts

* \`Ctrl / ⌘ + ;\` Toggle Sidebar
* \`Ctrl / ⌘ + S\` Save File
* \`Ctrl / ⌘ + .\` Toggle Focus Mode

### Hidden functionality

* Long click/touch on file in sidebar to rename
* Long click/touch on \`New\` to choose file name before creating
* On touch device: Click on \`S\` right at the bottom to save file

When S3 bucket has versioning enabled and working on desktop browser, auto-save is enabled. Non-touch device do not support auto-safe, yet.

File size for editing is limit to 1MB (large text files with more than 200.000 characters will be loaded in a textarea instead of a markdown editor anyway).

### Setup S3 Bucket

1. Create a new *private* bucket in S3
   -> enable versioning and encryption if you like
2. Create a new user in IAM with programmatic access
   -> you nedd \`Access Key\` and \`Secret Key\`
3. Create Policy for the user with the following permissions: Read, Write, List, Delete [^Example Policy]
4. Modify the bucket CORS configuration to allow all origins (Bucket -> Permissions -> CORS) [^CORS]

[^CORS]:

\`\`\`
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "GET",
            "PUT",
            "POST",
            "DELETE",
            "HEAD"
        ],
        "AllowedOrigins": [
            "*"
        ],
        "ExposeHeaders": []
    }
]
\`\`\`

[^Example Policy]:

\`\`\`

\`\`\`


`.trim();
