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
echo $PROJECT_ID

for file in $DIR/*.params.env
do
    [ -f "$file" ] || break # exit if there are no files
    echo $file
    extensionId=$(basename ${file} .params.env )
    echo $extensionId
    echo $extensionId | \
        firebase ext:install firebase/firestore-bigquery-export \
        --params=$file \
        --project=$PROJECT_ID \
        --force
done

# echo "collection_nfts" | \
#   firebase ext:install firebase/firestore-bigquery-export \
#   --params=$DIR/users.params.env \
#   --project=$PROJECT_ID \
#   --force

# echo "feed" | \
#   firebase ext:install firebase/firestore-bigquery-export \
#   --params=$DIR/events.params.env \
#   --project=$PROJECT_ID \
#   --force