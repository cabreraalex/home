#!/bin/bash
git add -A
git commit -m "$1"
git push origin master
npm run build
git subtree push --prefix public origin gh-pages