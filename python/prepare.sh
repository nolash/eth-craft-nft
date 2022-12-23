#!/bin/bash

venv=1
if [ ! -d .venv ]; then
	python3 -m venv .venv
	if [ "$?" -ne "0" ]; then
		>&2 echo "venv module doesn't seem to exiss"
		venv=0
	fi
fi

if [ "$venv" -eq "1" ]; then
	. .venv/bin/activate
	if [ "$?" -ne "0" ]; then
		>&2 echo "virtualenv doesn't seem to exiss"
		venv=0
	fi
fi

pip install -r requirements.txt
pip install -r test_requirements.txt

if [ "$venv" -eq "1" ]; then
	deactivate
fi
