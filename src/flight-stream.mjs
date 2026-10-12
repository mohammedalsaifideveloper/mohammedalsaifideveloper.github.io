import vm from 'node:vm';

// Flight text rows declare UTF-8 byte lengths. Rebranding a raw text row must
// update its length; otherwise the following component is consumed as text.
export function flightPayload(html) {
  const chunks = [];
  for (const match of html.matchAll(/<script>(self\.__next_f\.push\([\s\S]*?)<\/script>/g)) {
    vm.runInNewContext(match[1], {self: {__next_f: {push: value => chunks.push(value)}}});
  }
  return chunks.filter(value => value[0] === 1).map(value => value[1]).join('');
}

export function parseFlight(stream) {
  const bytes = Buffer.from(stream), records = new Map(), imports = new Map(), textRows = [];
  let offset = 0;
  while (offset < bytes.length) {
    if (bytes[offset] === 10) {offset++; continue;}
    const header = bytes.subarray(offset).toString('utf8').match(/^([\da-f]*):/);
    if (!header) throw new Error('Invalid Flight row boundary at byte ' + offset);
    const id = header[1]; offset += header[0].length;
    const textHeader = bytes.subarray(offset).toString('utf8').match(/^T([\da-f]+),/);
    if (textHeader) {
      offset += textHeader[0].length;
      const length = parseInt(textHeader[1], 16);
      const text = bytes.subarray(offset, offset + length).toString('utf8');
      if (Buffer.byteLength(text) !== length || text.includes('\uFFFD')) throw new Error('Invalid UTF-8 text row ' + id);
      records.set(id, text); textRows.push({id,length}); offset += length;
      continue;
    }
    let end = bytes.indexOf(10, offset); if (end < 0) end = bytes.length;
    const row = bytes.subarray(offset, end).toString('utf8'); offset = end + 1;
    if (row.startsWith('I')) imports.set(id, JSON.parse(row.slice(1)));
    else if (!/^[A-Z]/.test(row)) records.set(id, JSON.parse(row));
  }
  return {records,imports,textRows};
}

function isRow(bytes,offset) {
  const tail=bytes.subarray(offset).toString('utf8');
  const header=tail.match(/^([\da-f]+):/); if(!header)return false;
  const body=tail.slice(header[0].length);
  if(/^T[\da-f]+,/.test(body))return true;
  const line=body.split('\n')[0];
  try {JSON.parse(line.startsWith('I')?line.slice(1):line);return true;} catch {return /^[CX]$/.test(line);}
}

export function repairFlightTextLengths(stream) {
  const bytes=Buffer.from(stream), parts=[], repairs=[];
  let offset=0;
  while(offset<bytes.length) {
    const start=offset;
    if(bytes[offset]===10){parts.push(bytes.subarray(offset,++offset));continue;}
    const header=bytes.subarray(offset).toString('utf8').match(/^([\da-f]*):/);
    if(!header)throw new Error('Invalid retained row at '+offset);
    const id=header[1];offset+=header[0].length;
    const textHeader=bytes.subarray(offset).toString('utf8').match(/^T([\da-f]+),/);
    if(!textHeader) {
      let end=bytes.indexOf(10,offset);if(end<0)end=bytes.length-1;
      offset=end+1;parts.push(bytes.subarray(start,offset));continue;
    }
    offset+=textHeader[0].length;
    const declared=parseInt(textHeader[1],16), expected=offset+declared;
    let boundary=expected;
    if(!isRow(bytes,boundary)&&bytes[boundary]!==10&&boundary!==bytes.length) {
      // Recovery is limited to nearby syntactically valid row headers in these
      // retained, known page snapshots. Ambiguous rows abort instead of guessing.
      const candidates=[];
      const from=Math.max(offset,expected-2048),to=Math.min(bytes.length,expected+2048);
      const region=bytes.subarray(from,to).toString('latin1');
      for(const match of region.matchAll(/[\da-f]+:(?=T[\da-f]+,|I\[|\[|\{|"|null)/g)) {
        const position=from+match.index;
        if(isRow(bytes,position))candidates.push(position);
      }
      candidates.sort((a,b)=>Math.abs(a-expected)-Math.abs(b-expected));
      if(!candidates.length || (candidates[1]!==undefined&&Math.abs(candidates[0]-expected)===Math.abs(candidates[1]-expected)))throw new Error('Cannot safely repair text row '+id);
      boundary=candidates[0];
    }
    const length=boundary-offset;
    if(length!==declared)repairs.push({id,previousBytes:declared,bytes:length});
    parts.push(Buffer.from(id+':T'+length.toString(16)+','),bytes.subarray(offset,boundary));
    offset=boundary;
  }
  const corrected=Buffer.concat(parts).toString('utf8');
  parseFlight(corrected);
  return {stream:corrected,repairs};
}

export function repairRouteFlight(html) {
  const original=flightPayload(html),{stream,repairs}=repairFlightTextLengths(original);
  if(!repairs.length)return {html,repairs};
  let written=false;
  const corrected=html.replace(/<script>(self\.__next_f\.push\([\s\S]*?)<\/script>/g,(tag,code)=>{
    let chunk;
    vm.runInNewContext(code,{self:{__next_f:{push:value=>{chunk=value;}}}});
    if(chunk?.[0]!==1)return tag;
    if(written)return '';
    written=true;
    return '<script>self.__next_f.push('+JSON.stringify([1,stream]).replaceAll('<','\\u003c')+')</script>';
  });
  parseFlight(flightPayload(corrected));
  return {html:corrected,repairs};
}
