#!/bin/bash

# USAGE: ./install.sh <projectId>
# e.g: ./install.sh nftc-dev

# this script:
# 0. installs the firestore to bigquery streaming extension for various collections

display_usage() { 
    echo -e "\nUsage: ./install.sh <projectId> \n" 
}

# if less than two arguments supplied, display usage 
if [  $# -le 0 ] 
then 
    display_usage
    exit 1
fi 

PROJECT_ID=$1
DIR="$(cd "$(dirname "$0")" && pwd)"

for file in $DIR/*.params.env
do
    [ -f "$file" ] || break # exit if there are no files
    extensionId=$(basename ${file} .params.env )
    echo $extensionId | \
        firebase ext:install firebase/firestore-bigquery-export \
        --params=$file \
        --project=$PROJECT_ID \
        --force
done

# generate View Schemas from Table Schemas:
# npx @firebaseextensions/fs-bq-schema-views \
#   --non-interactive \
#   --project=$PROJECT_ID \
#   --dataset=$DATASET_ID \
#   --table-name-prefix=$TABLE_PREFIX \
#   --schema-files=./$SCHEMA_JSON_FILE.json
# example:
# npx @firebaseextensions/fs-bq-schema-views \
#   --non-interactive \
#   --project=nftc-dev \
#   --dataset=fs_mirror_feed \
#   --table-name-prefix=feed \
#   --schema-files=./fs-bq-ext-feed.json
