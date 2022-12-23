#!/bin/bash

if [ ! -d .venv ]; then
	virtualenv .venv
fi

venv=1
. .venv/bin/activate
if [ $? -ne "0" ]; then
	>&2 echo "virtualenv doesn't seem to exiss"
	venv=0
fi

pip install -r requirements.txt
pip install -r test_requirements.txt

if [ $venv == "1" ]; then
	deactivate
fi
