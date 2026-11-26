#!/usr/bin/env python3
"""Generate a credential-free Shizudio album publishing Shortcut.

Usage: python3 scripts/build-photodump-shortcut.py /tmp/photodump.unsigned.shortcut
Then: shortcuts sign --mode anyone --input /tmp/photodump.unsigned.shortcut --output public/shortcuts/photodump.shortcut
The signed template contains no credential. Configure and test on iPhone before automation.
"""
from pathlib import Path
import plistlib
import sys
import uuid

def uid(): return str(uuid.uuid4()).upper()
def action(name, **params):
    params.setdefault('UUID', uid())
    return {'WFWorkflowActionIdentifier': 'is.workflow.actions.' + name, 'WFWorkflowActionParameters': params}
def ref(a, name='Output'):
    return {'OutputUUID': a['WFWorkflowActionParameters']['UUID'], 'Type': 'ActionOutput', 'OutputName': name}
def attach(value): return {'Value': value, 'WFSerializationType': 'WFTextTokenAttachment'}
def text(value, refs=None):
    state={'string': value}
    if refs: state['attachmentsByRange']=refs
    return {'Value': state, 'WFSerializationType': 'WFTextTokenString'}
def token(a, name='Output'): return text('\ufffc', {'{0, 1}': ref(a,name)})
def fields(items):
    return {'Value': {'WFDictionaryFieldValueItems': [
        {'WFItemType': typ, 'WFKey': text(k), 'WFValue': v} for k,v,typ in items
    ]}, 'WFSerializationType': 'WFDictionaryFieldValue'}

comment=action('comment', WFCommentActionText=(
    'Publish the photos in your Photodump album to your public website. '
    'Create a normal Photos album named Photodump first. Review the Find Photos filter after importing and select that album. '
    'Your photo date and approximate location will be public. Image metadata is removed by the server. '
    'Paste your private update key during setup. Never share the configured shortcut. '
    'Run manually first to grant Photos and network permissions. This is an upload-only sync: album removals do not unpublish photos. '
    'This template needs an iPhone end-to-end test before unattended use.'
))
key=action('gettext', WFTextActionText='REPLACE_WITH_PRIVATE_KEY')
endpoint=action('gettext', WFTextActionText='https://shizudio.me/api/photodump')
photos=action('filter.photos', WFContentItemFilter={
    'Value': {'WFActionParameterFilterPrefix': 1, 'WFActionParameterFilterTemplates': [
        {'Property':'Album','Operator':4,'Values':{'String':'Photodump'},'Removable':True}
    ]}, 'WFSerializationType':'WFContentPredicateTableTemplate'},
    WFContentItemSortProperty='Creation Date', WFContentItemSortOrder='Oldest First',
    WFContentItemLimitEnabled=False)
group=uid()
repeat=action('repeat.each', WFInput=attach(ref(photos,'Photos')), GroupingIdentifier=group, WFControlFlowMode=0)
item={'Type':'Variable','VariableName':'Repeat Item'}
date=action('properties.images', WFInput=attach(item), WFContentItemPropertyName='Date Taken')
formatted=action('format.date', WFDate=token(date), WFDateFormatStyle='ISO 8601', WFISO8601IncludeTime=True)
location=action('properties.images', WFInput=attach(item), WFContentItemPropertyName='Location')
resize=action('image.resize', WFImage=attach(item), WFImageResizeWidth=1600)
jpeg=action('image.convert', WFInput=attach(ref(resize)), WFImageFormat='JPEG', WFImageCompressionQuality=0.65, WFImagePreserveMetadata=False)
base64=action('base64encode', WFInput=attach(ref(jpeg)), WFEncodeMode='Encode', WFBase64LineBreakMode='None')
condition_group=uid()
condition=action('conditional', WFInput={'Type':'Variable','Variable':attach(ref(location))}, WFCondition=100, GroupingIdentifier=condition_group, WFControlFlowMode=0)
lat=action('properties.locations', WFInput=attach(ref(location)), WFContentItemPropertyName='Latitude')
lon=action('properties.locations', WFInput=attach(ref(location)), WFContentItemPropertyName='Longitude')
def post(with_location):
    values=[('imageBase64',token(base64),0),('capturedAt',token(formatted),0)]
    if with_location: values += [('latitude',token(lat),3),('longitude',token(lon),3)]
    return action('downloadurl', WFURL=token(endpoint), WFHTTPMethod='POST', WFHTTPBodyType='JSON',
        WFHTTPHeaders=fields([('Authorization',text('Bearer \ufffc',{'{7, 1}':ref(key)}),0),('Content-Type',text('application/json'),0)]),
        WFJSONValues=fields(values))
otherwise=action('conditional', GroupingIdentifier=condition_group, WFControlFlowMode=1)
endcondition=action('conditional', GroupingIdentifier=condition_group, WFControlFlowMode=2)
endrepeat=action('repeat.each', GroupingIdentifier=group, WFControlFlowMode=2)
# Display actual responses, rather than claiming success when the endpoint returns an error.
result=action('showresult', Text=token(endrepeat,'Repeat Results'))
actions=[comment,key,endpoint,photos,repeat,date,formatted,location,resize,jpeg,base64,condition,lat,lon,post(True),otherwise,post(False),endcondition,endrepeat,result]
workflow={
    'WFWorkflowName':'Sync Photodump', 'WFWorkflowActions':actions,
    'WFWorkflowClientVersion':'2605.0.5', 'WFWorkflowMinimumClientVersion':900,
    'WFWorkflowMinimumClientVersionString':'900',
    'WFWorkflowIcon':{'WFWorkflowIconStartColor':4282601983,'WFWorkflowIconGlyphNumber':61455},
    'WFWorkflowInputContentItemClasses':[], 'WFWorkflowOutputContentItemClasses':[],
    'WFWorkflowHasOutputFallback':False, 'WFWorkflowHasShortcutInputVariables':False,
    'WFWorkflowTypes':[],
    'WFWorkflowImportQuestions':[
        {'ActionIndex':1,'Category':'Parameter','ParameterKey':'WFTextActionText','Text':'Paste your private Photodump update key. Keep the configured shortcut private.','DefaultAnswer':'REPLACE_WITH_PRIVATE_KEY'},
        {'ActionIndex':2,'Category':'Parameter','ParameterKey':'WFTextActionText','Text':'Upload endpoint. Keep the default only once production has been deployed; use the staging URL for testing.','DefaultAnswer':'https://shizudio.me/api/photodump'}
    ]
}
output=Path(sys.argv[1] if len(sys.argv)>1 else '/tmp/photodump.unsigned.shortcut')
output.parent.mkdir(parents=True,exist_ok=True)
output.write_bytes(plistlib.dumps(workflow,fmt=plistlib.FMT_XML,sort_keys=False))
loaded=plistlib.loads(output.read_bytes())
assert len(loaded['WFWorkflowActions'])==20
assert loaded['WFWorkflowImportQuestions'][0]['ActionIndex']==1
assert key['WFWorkflowActionParameters']['WFTextActionText']=='REPLACE_WITH_PRIVATE_KEY'
assert photos['WFWorkflowActionParameters']['WFContentItemLimitEnabled'] is False
print(f'Wrote {output}: valid plist, 20 actions, placeholder credential only.')
