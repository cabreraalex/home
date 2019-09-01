#!/bin/bash
# Script for pushing changes to the repo and gh-pages
git add -A
git commit -m "$1"
git push origin master
npm run build
git subtree push --prefix public origin gh-pages