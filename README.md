# blacklist [![Build Status](https://travis-ci.org/gilt/blacklist.svg?branch=master)](https://travis-ci.org/gilt/blacklist)
A nanoservice that keeps track of recipients who should not be sent a certain type of communication


## Publishing changes
When the code for the Lambda functions changes, please run the following:

```
  bin/publish.sh (major|minor|patch)
```