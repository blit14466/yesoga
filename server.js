const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");

const app = express();

// Middleware
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const usersFile = "./users.json";
const messagesFile = "./messages.json";

// Route for homepage
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public/index.html"));
});

// Route for sign-up
app.post("/signup", (req, res) => {
    let { username, password } = req.body;

    // Load existing users
    let users = [];
    if (fs.existsSync(usersFile)) {
        users = JSON.parse(fs.readFileSync(usersFile));
    }

    // Check if user exists
    if (users.find(user => user.username === username)) {
        return res.json({ success: false, message: "Username already taken!" });
    }

    // Save new user
    users.push({ username, password });
    fs.writeFileSync(usersFile, JSON.stringify(users));

    res.json({ success: true, message: "Account created successfully!" });
});

// Route for login
app.post("/login", (req, res) => {
    let { username, password } = req.body;

    // Load users
    if (!fs.existsSync(usersFile)) {
        return res.json({ success: false, message: "User not found!" });
    }
    
    let users = JSON.parse(fs.readFileSync(usersFile));
    let user = users.find(user => user.username === username && user.password === password);

    if (user) {
        res.json({ success: true, message: "Login successful!" });
    } else {
        res.json({ success: false, message: "Invalid credentials!" });
    }
});

// Route to edit user profile
app.post("/edit-profile", (req, res) => {
    let { username, newUsername, bio } = req.body;

    // Load existing users
    if (!fs.existsSync(usersFile)) {
        return res.json({ success: false, message: "No users found!" });
    }

    let users = JSON.parse(fs.readFileSync(usersFile));
    let userIndex = users.findIndex(user => user.username === username);

    if (userIndex === -1) {
        return res.json({ success: false, message: "User not found!" });
    }

    // Update username and bio
    users[userIndex].username = newUsername || users[userIndex].username;
    users[userIndex].bio = bio || users[userIndex].bio;

    fs.writeFileSync(usersFile, JSON.stringify(users));

    res.json({ success: true, message: "Profile updated!" });
});

// Route for profile page (including messages)
app.get("/profile/:username", (req, res) => {
    let username = req.params.username;

    // Load users
    if (!fs.existsSync(usersFile)) {
        return res.json({ success: false, message: "No users found!" });
    }

    let users = JSON.parse(fs.readFileSync(usersFile));
    let user = users.find(user => user.username === username);

    if (user) {
        // Load user messages
        let messages = [];
        if (fs.existsSync(messagesFile)) {
            messages = JSON.parse(fs.readFileSync(messagesFile));
        }

        let userMessages = messages.filter(msg => msg.receiver === username);

        // Send profile data along with messages
        res.send(`
            <h1>${username}'s Profile</h1>
            <p>Username: ${username}</p>
            <p>Bio: ${user.bio || "No bio available"}</p>
            <h2>Messages</h2>
            ${userMessages.length > 0 ? userMessages.map(msg => `<p><strong>${msg.sender}:</strong> ${msg.message}</p>`).join('') : '<p>No messages yet.</p>'}
            <a href="/logout">Logout</a>
        `);
    } else {
        res.json({ success: false, message: "User not found!" });
    }
});

app.get("/profile/:username", (req, res) => {
    let username = req.params.username;

    if (!fs.existsSync(usersFile)) {
        return res.json({ success: false, message: "No users found!" });
    }

    let users = JSON.parse(fs.readFileSync(usersFile));
    let user = users.find(user => user.username === username);

    if (user) {
        let messages = [];
        if (fs.existsSync("./messages.json")) {
            messages = JSON.parse(fs.readFileSync("./messages.json"));
        }

        // Check for new messages
        let newMessages = messages.filter(msg => msg.receiver === username && !msg.read);
        let notificationMessage = newMessages.length ? `You have ${newMessages.length} new message(s)!` : '';

        // Send profile data and notification
        res.send(`
            <h1>${username}'s Profile</h1>
            <p>Username: ${username}</p>
            <p>Bio: ${user.bio || "No bio available"}</p>
            <p>${notificationMessage}</p>
            <h2>Messages</h2>
            ${messages.filter(msg => msg.receiver === username).map(msg => `<p><strong>${msg.sender}:</strong> ${msg.message}</p>`).join('')}
            <a href="/logout">Logout</a>
        `);
    } else {
        res.json({ success: false, message: "User not found!" });
    }
});

// Route to send message
app.post("/send-message", (req, res) => {
    let { sender, receiver, message } = req.body;

    let users = [];
    if (fs.existsSync(usersFile)) {
        users = JSON.parse(fs.readFileSync(usersFile));
    }

    let senderUser = users.find(user => user.username === sender);
    let receiverUser = users.find(user => user.username === receiver);

    if (!senderUser || !receiverUser) {
        return res.json({ success: false, message: "User not found!" });
    }

    // Check if the receiver is blocked by the sender
    if (senderUser.blockedUsers && senderUser.blockedUsers.includes(receiver)) {
        return res.json({ success: false, message: "You have blocked this user!" });
    }

    // Save the message
    let messages = [];
    if (fs.existsSync("./messages.json")) {
        messages = JSON.parse(fs.readFileSync("./messages.json"));
    }

    messages.push({ sender, receiver, message, timestamp: new Date() });
    fs.writeFileSync("./messages.json", JSON.stringify(messages));

    res.json({ success: true, message: "Message sent!" });
});

// Route for user search
app.get("/search/:username", (req, res) => {
    let searchQuery = req.params.username;

    if (!fs.existsSync(usersFile)) {
        return res.json({ success: false, message: "No users found!" });
    }

    let users = JSON.parse(fs.readFileSync(usersFile));
    let results = users.filter(user => user.username.includes(searchQuery));

    if (results.length > 0) {
        res.json({ success: true, results });
    } else {
        res.json({ success: false, message: "No users found." });
    }
});

// Route to block a user
app.post("/block", (req, res) => {
    let { username, blockedUser } = req.body;

    let users = [];
    if (fs.existsSync(usersFile)) {
        users = JSON.parse(fs.readFileSync(usersFile));
    }

    let user = users.find(user => user.username === username);
    if (!user) {
        return res.json({ success: false, message: "User not found!" });
    }

    if (!user.blockedUsers) {
        user.blockedUsers = [];
    }

    // Block the user
    if (!user.blockedUsers.includes(blockedUser)) {
        user.blockedUsers.push(blockedUser);
        fs.writeFileSync(usersFile, JSON.stringify(users));
        res.json({ success: true, message: `You have blocked ${blockedUser}` });
    } else {
        res.json({ success: false, message: `${blockedUser} is already blocked.` });
    }
});

// Route to unblock a user
app.post("/unblock", (req, res) => {
    let { username, blockedUser } = req.body;

    let users = [];
    if (fs.existsSync(usersFile)) {
        users = JSON.parse(fs.readFileSync(usersFile));
    }

    let user = users.find(user => user.username === username);
    if (!user) {
        return res.json({ success: false, message: "User not found!" });
    }

    // Unblock the user
    if (user.blockedUsers && user.blockedUsers.includes(blockedUser)) {
        user.blockedUsers = user.blockedUsers.filter(user => user !== blockedUser);
        fs.writeFileSync(usersFile, JSON.stringify(users));
        res.json({ success: true, message: `You have unblocked ${blockedUser}` });
    } else {
        res.json({ success: false, message: `${blockedUser} is not blocked.` });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});