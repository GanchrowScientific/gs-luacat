#!/bin/bash

PROJECT_PATH="$(dirname $0)/../"
PROJECT_NAME="$(basename $(readlink -f $PROJECT_PATH))"

VERSION=$(${PROJECT_PATH}scripts/get-version $PROJECT_PATH)

echo Creating tag $VERSION
git tag -f $VERSION

echo Pushing to github
git push -f git@github.com:GanchrowScientific/${PROJECT_NAME}.git +HEAD:master $VERSION
