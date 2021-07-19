/**
 * @copyright: Copyright (C) 2019
 * @desc: ts packet demux
 * @author: liuliguo 
 * @file: TsDemux.js
 */

import { Events as DemuxerEvents, FLVDemux } from 'demuxer';

class FlvDemux {
  maxAudioPTS = 0
  maxVideoPTS = 0
  audioSpecificConfig = null
  adtsFixHeader = new Uint8Array(4)

  constructor(decode) {
    if (!decode) {
      console.error('class TsDemux need pass decode parmas')
      return
    }
    this.init()
    this.dataArray = []
    this.videoArray = []
    this.audioArray = []
    this.decode = decode
  }
  init() {
    try {
      this.demuxer = new FLVDemux({
        enableWorker: false,
        debug: false,
        onlyDemuxElementary: true
      })

      this.demuxer.on(DemuxerEvents.DEMUX_DATA, event => {
        this.dataArray.push(event)
        this.demuxed(this.dataArray)
        this.dataArray = []
      })

      this.demuxer.on(DemuxerEvents.DONE, event => {
        let pes = {}
        this.demuxed(this.dataArray)
        this.dataArray = []
      
        this.maxPTS = Math.min(this.maxAudioPTS, this.maxVideoPTS)
        //the audio has finished
        self.postMessage({
          type: 'demuxedAAC',
          data: this.audioArray
        })
        this.audioArray = []

        self.postMessage({
          type: 'maxPTS',
          data: {
            maxAudioPTS: this.maxAudioPTS,
            maxVideoPTS: this.maxVideoPTS
          }
        })

        //start decode H265
        this.decode.push(this.videoArray)
        this.videoArray = []
      })
    } catch (error) {
      console.error('init demuxer failed.', error)
    }
  }
  push(data) {
    this.demuxer.push(data, { done: true })
  }
  demuxed(dataArray) {
    dataArray.forEach(data => {
      this.flvDemuxed(data)
    })
  }
  flvDemuxed(data) {
    let tagType = data.tagType
    switch (tagType) {
      case 9:
        if (data.videoData.avcPacketType == 1) {
          let vd = data.videoData || {}
          this.videoQueue(vd)
        }
        break
      case 3:
      case 15:
      case 8:
        let sd = data.soundData || {}
        if (sd.aacPacketType == 0) {
          this.audioSpecificConfig = sd.audioSpecificConfig

          this.adtsFixHeader[0] = 0xFF

          let nextByte = 0xF0 | (0 << 3) | (0 << 1) | 1
          this.adtsFixHeader[1] = nextByte

          nextByte = (this.audioSpecificConfig.audioObjectType - 1) << 6
          nextByte |= (this.audioSpecificConfig.samplingFrequencyIndex & 0x0F) << 2
          nextByte |= (0 << 1)
          nextByte |= (this.audioSpecificConfig.channelConfiguration & 0x04) >> 2
          this.adtsFixHeader[2] = nextByte

          nextByte = (this.audioSpecificConfig.channelConfiguration & 0x03) << 6
          nextByte |= (0 << 5)
          nextByte |= (0 << 4)
          nextByte |= (0 << 3)
          nextByte |= (0 << 2)
          this.adtsFixHeader[3] = nextByte
        } else {
          // add header 
          let adtsHeader = new Uint8Array(7)
          adtsHeader.set(this.adtsFixHeader)
          let adtsLength = (sd.payload.length + 7)
          adtsHeader[3] |= (adtsLength & 0x1800) >> 11
          adtsHeader[4] = (adtsLength & 0x7F8) >> 3
          adtsHeader[5] = ((adtsLength & 0x7) << 5) | 0x1F
          adtsHeader[6] = 0xFC

          sd.pts = Math.round(sd.pts)
          this.maxAudioPTS = Math.max(sd.pts, this.maxAudioPTS)

          let adts = new Uint8Array(7 + sd.payload.length)
          adts.set(adtsHeader)
          adts.set(sd.payload, 7)
          this.audioQueue({
            pts: sd.pts,
            payload: adts
          })
        }
        break
      default:
        break
    }
  }
  audioQueue(pes) {
    this.audioArray.push(pes)
  }
  videoQueue(pes) {
    this.videoArray.push(pes)
  }
  destroy() {
    this.demuxer.destroy()
  }
}
export default FlvDemux