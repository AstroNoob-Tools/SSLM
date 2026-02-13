# Introduction

The goal of this application is to manage my astrophotography stored on my seestar. I would like to maintain them and organise them.


#   Connected Seestar Scenario

if the seestar is connected, the pictures would be placed under a root folder on the seestar called MyWork. From there, the application should ask me where i would put the local copy of the images stored on the seestar.
if the seestar is connected, the pictures would be placed under a root folder on the seestar called MyWork.


#   Disconnected SeeStar Scenario

If the seestar is not connected, the application should ask me where my local copy of the seestar content is located
If i work on a local copy made to my computer, the pictures will be under a chosen directory.


So, this application should ask me first on which external drive is the seestar connected or if i want to work with a local copy stored on my computer.

# File Organisation

In both case, the structure of the files under the main directory will be the same. There will be 2 type of configuration.

##   No sub frames  

if the pictures were taken without sub frames, there will be only one folder named after the registered catalog name of the objects of which the picture was taken. For example M47, M48, IC 434, NGC 2024 etc etc. Under this folder, there will be 2 types of files
    1)  Files with the extension ".fit"
    2)  standard image file (.jpg, .tiff ... ...)

## With sub frames

If the picture was taken with sub frame, there will be 2 directories, one with the name of the object discribed above and another one with the same name suffixed with "_sub".
For example, if the object name is IC 2177, there will be a directory called IC 2177 and one called IC 2177_sub.
the directory of the object name will still contain as described above.
the directory "_sub" will contain a lot of fit files and jpg files.
the jpg files inside the "_sub" directory are actually not needed.

#   Functionalities

#   First Steps

The application should first ask the question if i want to import the content of the seestar on local drive or work directly on the local copy of the seestar drive.

IMPORTANT: The application must not work directly on the hard drive of the see star.

If selection of importing seestar content is choosen, ask where on the local system this copy should be placed (the seestar can contain up to 50GB of data).

Once copy is done or selected drive done, i should have a dashboard presenting me aggregated data like number of objects present, number of objects with sub frames, number of object without subframes etc.

# Further Steps

Will be considered once dashbloard is finalised.
