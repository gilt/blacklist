#!/bin/bash

./bin/package.js
git add -u
npm version $1
git push origin master