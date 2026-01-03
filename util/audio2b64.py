import base64
import os

def audio2base64(audio_path):
    with open(audio_path, 'rb') as file:
        return base64.b64encode(file.read()).decode()


def main(filepath):
    filelist = next(os.walk(filepath))[2]

    audio_file = {}
    for file in filelist:
        if '.mp3' in file:
            # print(file, os.path.isfile(file))
            audio_file[file] = audio2base64(file)

    for k, v in audio_file.items():
        idx = k.find('.')
        print(f'\nconst {k[:idx]}_audio = "{v}";')


if __name__ == '__main__':
    main('.')
