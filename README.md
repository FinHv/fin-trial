# **fin-trial**

**fin-trial** is a Node.js application that monitors and manages user quotas and trials in a `glftpd`/IRC environment.

---

## **Features**

- **User Management**: Manage user statuses (`Quota`, `Trial`, and `Deletion`) directly via IRC commands.
- **Quota Monitoring**: Automatically monitor and reset user quotas on a weekly basis.
- **Trial Monitoring**: Track and manage users during their trial period.
- **Daily Reports**: Generate and announce daily reports of top uploaders for specified channels.
- **Blowfish Encryption**: Secure communication using Blowfish-encrypted messages.

---

## **Public Commands**

### **!top**
- **Description**: Displays the top uploaders, including users in `Quota` and `Trial` statuses.
- **Usage**: `!top`
- **Response Example**:

```
<@BOT> WEEKLY QUOTA: 13 Users - 3 days, 10 hours, 21 minutes Remaining - (Min 250GB)
<@BOT> [ 01 ] name1/iND ( 1.9TB Up ) is currently PASSING.
<@BOT> [ 02 ] name2/iND ( 1.4TB Up ) is currently PASSING.
<@BOT> [ 03 ] name3/iND ( 991.1GB Up ) is currently PASSING.
<@BOT> [ 04 ] name4/iND ( 825.2GB Up ) is currently PASSING.
<@BOT> [ 05 ] name5/iND ( 803.4GB Up ) is currently PASSING.
<@BOT> [ 06 ] name6/iND ( 642.5GB Up ) is currently PASSING.
<@BOT> [ 07 ] name7/iND ( 626.6GB Up ) is currently PASSING.
<@BOT> [ 08 ] name/iND ( 466.8GB Up ) is currently PASSING.
<@BOT> [ 09 ] name/iND ( 396.4GB Up ) is currently PASSING.
<@BOT> [ 10 ] name/iND ( 360.0GB Up ) is currently PASSING.
<@BOT> [ 11 ] name/iND ( 254.0GB Up ) is currently PASSING.
<@BOT> [ 12 ] name/iND ( 244.1GB Up ) is currently FAILING.
<@BOT> [ 13 ] name/iND ( 84.4GB Up ) is currently FAILING.
<@BOT> 
<@BOT> TRIAL QUOTA: Trial List - 2 Trialing - (Min 150GB)
<@BOT> [ 1 ] name/iND ( 144.1GB Up ) is currently FAILING.
<@BOT> [ 2 ] name/iND ( 84.4GB Up ) is currently FAILING.
```


## **Staff Commands (`!ft`)**

Available **only** in staff channels for authorized users.

### **!ft trial <username>**
- **Description**: Moves a user to `Trial` status.
- **Usage**: `!ft trial <username>`
- **Example**:

```
!ft trial JohnDoe 
```

```
<@BOT> User JohnDoe updated to trial.
```

### **!ft quota <username>**
- **Description**: Moves a user to `Quota` status.
- **Usage**: `!ft quota <username>`
- **Example**:
```
!ft quota JohnDoe
```

```
<@BOT> User JohnDoe updated to quota.
```

### **!ft extend <username> <days>**
- **Description**: Extends the trial or quota period for a user by the specified number of days.
- **Usage**: `!ft extend <username> <days>`
- **Example**:
```
!ft extend JohnDoe 7
```

```
<@BOT> User JohnDoe's period extended by 7 days.
```

### **!ft delete <username>**
- **Description**: Flags the user for deletion and creates a goodbye file.
- **Usage**: `!ft delete <username>`
- **Example**:
```
!ft delete JohnDoe
```

```
<@BOT> User JohnDoe marked for deletion.
```

When you run it: 
``` node --openssl-legacy-provider main.js ```
It will create a sqlite database and every user is put on quota default and it updates the sqlite every x minutes. So if you fuck it up, you can just delete the database file and run again.  (see config to exlude users/groups) If you want to put user on trial do the command above. 
Its not needed to edit anything on the glftpd site. Ive build the bot so it will also responds to commands. (u can add your own commands if you want! See irc.js

The application connects to a znc server so create a new user, connect it to your channels and add the znc connection string in the config. 
connectstring:  username/network:password


example configuration:
```
{
  "server": {
    "host": "",
    "port": 1337,
    "ssl": true,
    "nickname": "BOT",
    "connectstring": "ST4TB0T/ninja:password",   
    "channels": [
     { "name": "#chan-chat", "blowfishKey": "ihihhiuhiu75r6dtsey54syr" },
      { "name": "#chan", "blowfishKey": "ihihhiuhiu75r6dtsey54syr" }
    ]
  },
  "paths": {
    "usersDir": "/glftpd/ftp-data/users",
    "byeFiles": "/glftpd/ftp-data/byefiles",
    "msgs": "/glftpd/ftp-data/msgs",
    "databaseFile": "user_stats.db"
  },
  "settings": {
    "updateInterval": 300000,
    "userSkip":  ["default.user", "NUKEBOT", "glftpd"],
    "excludedGroups": ["Admin", "SiteOP", "Friends", "Leech", "NUKERS", "NoGroup"],
    "announceTopDayChan": ["#chan-chat"],
    "BlowfishKeyTopDayChan": "ihihhiuhiu75r6dtsey54syr",
    "showTopDayUp": true,
    "showTopDayUpInterval": 28800000,
    "staffUsers": ["username","otheruser"],
    "staffChan": ["#chan-staff"],
    "blowfishKeyStaffChan": "ihihhiuhiu75r6dtsey54syr"
  },
  "trialConfig": {
    "quotaGB": "150",
    "daysDefault": 7,
    "enabled": true,
    "failSetFlagsTrial": "6"
  },
  "quotaConfig": {
    "quotaGB": "250",
    "enabled": true,
    "failSetFlagsQuota": "6",
    "failBackToTrial": true
  }
}
```

Top uploaders of the day: 
The bot will also show the top 10 uploaders in a interval (see config) in specified channel
```
<@BOT> TOP UPLOADERS FOR THE DAY: 10 Users
<@BOT> 01 shadowhawk - (1531 Files) - (119.7GB)
<@BOT> 02 pixelmaster - (617 Files) - (105.3GB)
<@BOT> 03 blaze - (564 Files) - (61.5GB)
<@BOT> 04 nightwolf - (831 Files) - (60.1GB)
<@BOT> 05 crimson - (815 Files) - (51.3GB)
<@BOT> 06 techie - (433 Files) - (34.3GB)
<@BOT> 07 skywalker - (329 Files) - (31.3GB)
<@BOT> 08 ghost - (624 Files) - (27.0GB)
<@BOT> 09 sentinel - (113 Files) - (21.2GB)
<@BOT> 10 thunderbolt - (256 Files) - (16.5GB)
<@BOT> TOTAL UPLOADS FOR THE DAY: 6113 Files - 528.4GB
```

